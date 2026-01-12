package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/config"
	httpserver "github.com/Replicant-Partners/Chrysalis/go-services/internal/http"
	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
)

func main() {
	cfg := config.FromEnv()

	// Select provider (mock by default; swap with real providers once wired)
	var provider llm.Provider
	if cfg.Provider == "openai" && cfg.OpenAIKey != "" {
		p, err := llm.NewOpenAIProvider(llm.OpenAIConfig{
			APIKey:       cfg.OpenAIKey,
			DefaultModel: "gpt-4o-mini",
		})
		if err != nil {
			log.Printf("failed to init openai provider, falling back to mock: %v", err)
			provider = llm.MockProvider{DefaultModel: "gpt-4o-mini"}
		} else {
			provider = p
		}
	} else {
		provider = llm.MockProvider{DefaultModel: "gpt-4o-mini"}
	}

	mux := http.NewServeMux()
	srv := httpserver.New(provider, cfg.AuthToken, cfg.RateLimitRPS, cfg.RateLimitBurst)
	srv.RegisterRoutes(mux)

	server := &http.Server{
		Addr:         ":" + strconv.Itoa(cfg.Port),
		Handler:      mux,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Graceful shutdown
	go func() {
		log.Printf("gateway listening on :%d (provider=%s, rps=%.2f, burst=%d)", cfg.Port, provider.ID(), cfg.RateLimitRPS, cfg.RateLimitBurst)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	<-ctx.Done()
	stop()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Println("gateway stopped")
}
