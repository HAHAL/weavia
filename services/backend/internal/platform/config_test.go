package platform

import "testing"

func TestProductionConfigRejectsDemoAndDefaults(t *testing.T) {
	base := Config{AppEnv: "production", DatabaseURL: "postgresql://release:secret@db.example/weavia?sslmode=require", WebOrigin: "https://weavia.example", StorageSigningKey: "a-long-random-production-signing-key"}
	if err := base.Validate(); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name   string
		change func(*Config)
	}{
		{"demo", func(c *Config) { c.DemoMode = true }},
		{"secret", func(c *Config) { c.StorageSigningKey = "weavia-development-only" }},
		{"database", func(c *Config) { c.DatabaseURL = "postgresql://weavia:weavia@localhost/weavia?sslmode=disable" }},
		{"origin", func(c *Config) { c.WebOrigin = "http://localhost:3000" }},
	} {
		c := base
		test.change(&c)
		if c.Validate() == nil {
			t.Fatalf("%s accepted", test.name)
		}
	}
}
