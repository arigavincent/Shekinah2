package mail

import "testing"

func TestSMTPValidationAndHeaderInjection(t *testing.T) {
	valid := Config{Enabled: true, Host: "smtp.ministry.test", Port: "587", From: "Shekinah <sender@ministry.test>", Security: "starttls", Username: "sender", Password: "password"}
	if e := valid.Validate(); e != nil {
		t.Fatal(e)
	}
	for _, change := range []func(*Config){func(c *Config) { c.From = "sender@ministry.test\r\nBcc: bad@test.invalid" }, func(c *Config) { c.Port = "99999" }, func(c *Config) { c.Security = "none" }, func(c *Config) { c.Password = "" }} {
		c := valid
		change(&c)
		if c.Validate() == nil {
			t.Fatal("invalid SMTP configuration accepted")
		}
	}
	local := Config{Enabled: true, Host: "127.0.0.1", Port: "1025", From: "sender@ministry.test", Security: "none"}
	if e := local.Validate(); e != nil {
		t.Fatal(e)
	}
	for _, m := range []Message{{To: []string{"user@ministry.test\r\nBcc: bad@test.invalid"}}, {To: []string{"user@ministry.test"}, Subject: "Hello\r\nBcc: bad@test.invalid"}, {To: []string{"user@ministry.test"}, ReplyTo: "user@ministry.test\r\nBcc: bad@test.invalid"}} {
		if e := SendWithConfig(Config{}, m); e == nil {
			t.Fatal("email header injection accepted")
		}
	}
}
