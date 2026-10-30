// Package integrations stores operational provider settings separately from deployment roots.
package integrations

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Field struct {
	Key      string   `json:"key"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Hint     string   `json:"hint,omitempty"`
	Required bool     `json:"required,omitempty"`
	Options  []string `json:"options,omitempty"`
	Default  string   `json:"default,omitempty"`
}
type Definition struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Fields      []Field  `json:"fields"`
	EnableKeys  []string `json:"-"`
}
type Config struct {
	Enabled bool              `json:"enabled"`
	Values  map[string]string `json:"values"`
}
type View struct {
	Definition
	Enabled    bool              `json:"enabled"`
	Values     map[string]string `json:"values"`
	Configured map[string]bool   `json:"configured"`
	Source     string            `json:"source"`
}
type Store struct {
	DB     *pgxpool.Pool
	Secret string
}

func settingsKey(id string) string { return "integration_v1_" + id }
func (s Store) aead() (cipher.AEAD, error) {
	if s.Secret == "" {
		return nil, errors.New("integration encryption is not configured")
	}
	key := sha256.Sum256([]byte("shekinah-operational-integrations-v1:" + s.Secret))
	block, e := aes.NewCipher(key[:])
	if e != nil {
		return nil, e
	}
	return cipher.NewGCM(block)
}
func (s Store) Load(ctx context.Context, id string) (Config, string, error) {
	def, ok := DefinitionFor(id)
	if !ok {
		return Config{}, "", errors.New("unknown integration")
	}
	fallback := Config{Values: map[string]string{}, Enabled: true}
	for _, f := range def.Fields {
		fallback.Values[f.Key] = strings.TrimSpace(os.Getenv(f.Key))
		if fallback.Values[f.Key] == "" {
			fallback.Values[f.Key] = f.Default
		}
	}
	if id == "firebase" && fallback.Values["FCM_SERVICE_ACCOUNT_JSON"] == "" {
		if file := os.Getenv("FCM_SERVICE_ACCOUNT_FILE"); file != "" {
			if b, e := os.ReadFile(file); e == nil && len(b) <= 128<<10 {
				fallback.Values["FCM_SERVICE_ACCOUNT_JSON"] = string(b)
			}
		}
	}
	for _, key := range def.EnableKeys {
		if fallback.Values[key] == "" {
			fallback.Enabled = false
		}
	}
	if s.DB == nil {
		return fallback, "environment", nil
	}
	var raw string
	e := s.DB.QueryRow(ctx, `SELECT value FROM app_settings WHERE key=$1`, settingsKey(id)).Scan(&raw)
	if errors.Is(e, pgx.ErrNoRows) {
		return fallback, "environment", nil
	}
	if e != nil {
		return Config{}, "", e
	}
	aead, e := s.aead()
	if e != nil {
		return Config{}, "", e
	}
	sealed, e := base64.StdEncoding.DecodeString(raw)
	if e != nil || len(sealed) < aead.NonceSize() {
		return Config{}, "", errors.New("stored integration settings are invalid")
	}
	plain, e := aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], []byte(settingsKey(id)))
	if e != nil {
		return Config{}, "", errors.New("could not decrypt integration settings")
	}
	var c Config
	if json.Unmarshal(plain, &c) != nil || c.Values == nil {
		return Config{}, "", errors.New("stored integration settings are invalid")
	}
	return c, "admin", nil
}
func (s Store) GetView(ctx context.Context, id string) (View, error) {
	def, ok := DefinitionFor(id)
	if !ok {
		return View{}, errors.New("unknown integration")
	}
	c, source, e := s.Load(ctx, id)
	if e != nil {
		return View{}, e
	}
	v := View{Definition: def, Enabled: c.Enabled, Source: source, Values: map[string]string{}, Configured: map[string]bool{}}
	for _, f := range def.Fields {
		value := c.Values[f.Key]
		v.Configured[f.Key] = value != ""
		if f.Kind != "secret" {
			v.Values[f.Key] = value
		}
	}
	return v, nil
}
func (s Store) Save(ctx context.Context, id string, enabled bool, values map[string]string, clear []string) error {
	def, ok := DefinitionFor(id)
	if !ok {
		return errors.New("unknown integration")
	}
	old, _, e := s.Load(ctx, id)
	if e != nil {
		return e
	}
	allowed := map[string]Field{}
	for _, f := range def.Fields {
		allowed[f.Key] = f
	}
	next := Config{Enabled: enabled, Values: map[string]string{}}
	for _, f := range def.Fields {
		next.Values[f.Key] = old.Values[f.Key]
	}
	for key, v := range values {
		f, ok := allowed[key]
		if !ok {
			return errors.New("unknown integration field")
		}
		if len(v) > 128<<10 {
			return errors.New("integration field is too large")
		}
		if f.Kind == "secret" && strings.TrimSpace(v) == "" {
			continue
		}
		next.Values[key] = strings.TrimSpace(v)
	}
	for _, key := range clear {
		f, ok := allowed[key]
		if !ok || f.Kind != "secret" {
			return errors.New("only secret fields can be cleared explicitly")
		}
		next.Values[key] = ""
	}
	if id == "mpesa" && enabled && next.Values["MPESA_CALLBACK_TOKEN"] == "" {
		token := make([]byte, 32)
		if _, e = rand.Read(token); e != nil {
			return e
		}
		next.Values["MPESA_CALLBACK_TOKEN"] = base64.RawURLEncoding.EncodeToString(token)
	}
	if e = Validate(def, next); e != nil {
		return e
	}
	aead, e := s.aead()
	if e != nil {
		return e
	}
	nonce := make([]byte, aead.NonceSize())
	if _, e = rand.Read(nonce); e != nil {
		return e
	}
	plain, e := json.Marshal(next)
	if e != nil {
		return e
	}
	sealed := base64.StdEncoding.EncodeToString(aead.Seal(nonce, nonce, plain, []byte(settingsKey(id))))
	if s.DB == nil {
		return errors.New("integration storage is unavailable")
	}
	_, e = s.DB.Exec(ctx, `INSERT INTO app_settings(key,value)VALUES($1,$2)ON CONFLICT(key)DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, settingsKey(id), sealed)
	return e
}
func (s Store) RestoreEnvironment(ctx context.Context, id string) error {
	if _, ok := DefinitionFor(id); !ok {
		return fmt.Errorf("unknown integration")
	}
	_, e := s.DB.Exec(ctx, `DELETE FROM app_settings WHERE key=$1`, settingsKey(id))
	return e
}
