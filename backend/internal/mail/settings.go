package mail

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
	"net"
	netmail "net/mail"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const settingsKey = "smtp_configuration_v1"

type Config struct {
	Enabled  bool   `json:"enabled"`
	Host     string `json:"host"`
	Port     string `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	From     string `json:"from"`
	Security string `json:"security"`
}

func FromEnvironment() Config {
	c := Config{Host: env("SMTP_HOST"), Port: env("SMTP_PORT"), Username: env("SMTP_USERNAME"), Password: env("SMTP_PASSWORD"), From: env("SMTP_FROM"), Security: "auto"}
	c.Enabled = c.Host != "" && c.Port != "" && c.From != ""
	if c.Port == "465" {
		c.Security = "tls"
	}
	return c
}
func (c Config) Configured() bool { return c.Enabled && c.Host != "" && c.Port != "" && c.From != "" }
func (c Config) Validate() error {
	for _, v := range []string{c.Host, c.Port, c.Username, c.From} {
		if len(v) > 500 || strings.ContainsAny(v, "\r\n") {
			return errors.New("check SMTP settings")
		}
	}
	if len(c.Password) > 4096 {
		return errors.New("SMTP password is too long")
	}
	if !c.Enabled {
		return nil
	}
	if c.Host == "" || strings.ContainsAny(c.Host, "/ @\t") {
		return errors.New("use an SMTP hostname without a URL or port")
	}
	port, e := strconv.Atoi(c.Port)
	if e != nil || port < 1 || port > 65535 {
		return errors.New("use an SMTP port between 1 and 65535")
	}
	if _, e = netmail.ParseAddress(c.From); e != nil {
		return errors.New("use a valid sender email, optionally with a display name")
	}
	switch c.Security {
	case "tls", "starttls":
	case "none":
		ip := net.ParseIP(c.Host)
		if c.Host != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return errors.New("use TLS or STARTTLS for a remote SMTP server")
		}
	default:
		return errors.New("choose TLS or STARTTLS")
	}
	if (c.Username == "") != (c.Password == "") {
		return errors.New("supply both SMTP username and password, or leave both empty")
	}
	return nil
}

type Store struct {
	DB     *pgxpool.Pool
	Secret string
}

func (s Store) Load(ctx context.Context) (Config, string, error) {
	if s.DB == nil {
		return FromEnvironment(), "environment", nil
	}
	var raw string
	e := s.DB.QueryRow(ctx, `SELECT value FROM app_settings WHERE key=$1`, settingsKey).Scan(&raw)
	if errors.Is(e, pgx.ErrNoRows) {
		return FromEnvironment(), "environment", nil
	}
	if e != nil {
		return Config{}, "", e
	}
	if s.Secret == "" {
		return Config{}, "", errors.New("SMTP encryption is not configured")
	}
	block, _ := aes.NewCipher(s.key())
	aead, _ := cipher.NewGCM(block)
	sealed, e := base64.StdEncoding.DecodeString(raw)
	if e != nil || len(sealed) < aead.NonceSize() {
		return Config{}, "", errors.New("stored SMTP configuration is invalid")
	}
	data, e := aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], []byte(settingsKey))
	if e != nil {
		return Config{}, "", errors.New("cannot decrypt SMTP settings with the server key")
	}
	var c Config
	if e = json.Unmarshal(data, &c); e != nil {
		return Config{}, "", errors.New("stored SMTP configuration is invalid")
	}
	return c, "admin", nil
}
func (s Store) key() []byte {
	k := sha256.Sum256([]byte("shekinah-smtp-settings-v1:" + s.Secret))
	return k[:]
}
func (s Store) Save(ctx context.Context, c Config) error {
	if s.DB == nil || s.Secret == "" {
		return errors.New("SMTP settings encryption is unavailable")
	}
	if e := c.Validate(); e != nil {
		return e
	}
	data, e := json.Marshal(c)
	if e != nil {
		return e
	}
	block, _ := aes.NewCipher(s.key())
	aead, _ := cipher.NewGCM(block)
	nonce := make([]byte, aead.NonceSize())
	if _, e = rand.Read(nonce); e != nil {
		return e
	}
	raw := base64.StdEncoding.EncodeToString(aead.Seal(nonce, nonce, data, []byte(settingsKey)))
	_, e = s.DB.Exec(ctx, `INSERT INTO app_settings(key,value)VALUES($1,$2)ON CONFLICT(key)DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`, settingsKey, raw)
	if e != nil {
		return fmt.Errorf("save SMTP configuration: %w", e)
	}
	return nil
}
