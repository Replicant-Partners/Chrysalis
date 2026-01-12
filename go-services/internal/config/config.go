package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

// Config holds runtime configuration for the gateway service.
type Config struct {
  Port          int
  Provider      string
  ReadTimeout   time.Duration
  WriteTimeout  time.Duration
  IdleTimeout   time.Duration
  AuthToken     string
  OpenAIKey     string
  RateLimitRPS  float64
  RateLimitBurst int
}

// FromEnv loads configuration from environment variables with sensible defaults.
func FromEnv() Config {
	return Config{
		Port:          intFromEnv("GATEWAY_PORT", 8080),
		Provider:      strFromEnv("LLM_PROVIDER", "mock"),
		ReadTimeout:   durationFromEnv("HTTP_READ_TIMEOUT_MS", 15_000),
		WriteTimeout:  durationFromEnv("HTTP_WRITE_TIMEOUT_MS", 15_000),
		IdleTimeout:   durationFromEnv("HTTP_IDLE_TIMEOUT_MS", 60_000),
		AuthToken:     os.Getenv("GATEWAY_AUTH_TOKEN"),
		OpenAIKey:     os.Getenv("OPENAI_API_KEY"),
		RateLimitRPS:  floatFromEnv("GATEWAY_RATE_RPS", 10),
		RateLimitBurst: intFromEnv("GATEWAY_RATE_BURST", 20),
	}
}

func intFromEnv(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
		log.Printf("config: invalid int for %s=%s, using default %d", key, v, def)
	}
	return def
}

func durationFromEnv(key string, defMs int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return time.Duration(i) * time.Millisecond
		}
		log.Printf("config: invalid duration for %s=%s, using default %dms", key, v, defMs)
	}
	return time.Duration(defMs) * time.Millisecond
}

func strFromEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func floatFromEnv(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
		log.Printf("config: invalid float for %s=%s, using default %f", key, v, def)
	}
	return def
}
