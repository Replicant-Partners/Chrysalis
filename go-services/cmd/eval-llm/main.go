package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Replicant-Partners/Chrysalis/go-services/internal/llm"
)

type EvaluateTask struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	Prompt   string `json:"prompt"`
	Model    struct {
		Provider string `json:"provider"`
		Name     string `json:"name"`
		Endpoint string `json:"endpoint,omitempty"`
		APIKey   string `json:"apiKey,omitempty"`
	} `json:"model"`
	Parameters struct {
		Temperature   float64  `json:"temperature,omitempty"`
		MaxTokens     int      `json:"maxTokens,omitempty"`
		TopP          float64  `json:"topP,omitempty"`
		StopSequences []string `json:"stopSequences,omitempty"`
	} `json:"parameters,omitempty"`
	Options struct {
		OutputPath      string `json:"outputPath,omitempty"`
		IncludeMetadata bool   `json:"includeMetadata,omitempty"`
		TimeoutMS       int    `json:"timeoutMs,omitempty"`
	} `json:"options,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type BatchTask struct {
	Type        string         `json:"type"`
	Name        string         `json:"name"`
	Tasks       []EvaluateTask `json:"tasks"`
	StopOnError bool           `json:"stopOnError,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type EvaluationResult struct {
	Response     string `json:"response"`
	TokensIn     int    `json:"tokensIn"`
	TokensOut    int    `json:"tokensOut"`
	LatencyMS    int64  `json:"latencyMs"`
	FinishReason string `json:"finishReason"`
	Model        string `json:"model"`
	Provider     string `json:"provider"`
	Error        string `json:"error,omitempty"`
}

func main() {
	taskFile := flag.String("task", "", "Path to task JSON file")
	parallel := flag.Int("parallel", 4, "Number of parallel evaluations")
	verbose := flag.Bool("verbose", false, "Verbose logging")
	flag.Parse()

	if *taskFile == "" {
		fmt.Println("Usage: eval-llm -task <task-file.json> [-parallel 4] [-verbose]")
		os.Exit(1)
	}

	data, err := os.ReadFile(*taskFile)
	if err != nil {
		log.Fatalf("Failed to read task file: %v", err)
	}

	var baseTask struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &baseTask); err != nil {
		log.Fatalf("Failed to parse task: %v", err)
	}

	fmt.Printf("🔄 LLM Evaluation Service\n\n")
	fmt.Printf("📂 Task: %s\n", *taskFile)
	fmt.Printf("🔧 Workers: %d\n\n", *parallel)

	switch baseTask.Type {
	case "evaluate":
		var task EvaluateTask
		if err := json.Unmarshal(data, &task); err != nil {
			log.Fatalf("Failed to parse evaluate task: %v", err)
		}
		result := executeEvaluateTask(task, *verbose)
		printResult(result)

	case "batch":
		var task BatchTask
		if err := json.Unmarshal(data, &task); err != nil {
			log.Fatalf("Failed to parse batch task: %v", err)
		}
		results := executeBatchTask(task, *parallel, *verbose)
		printBatchResults(results)

	default:
		log.Fatalf("Unknown task type: %s", baseTask.Type)
	}
}

func executeEvaluateTask(task EvaluateTask, verbose bool) EvaluationResult {
	start := time.Now()

	var provider llm.Provider
	var err error

	switch strings.ToLower(task.Model.Provider) {
	case "ollama":
		cfg := llm.OllamaConfig{
			BaseURL:      getStringOrDefault(task.Model.Endpoint, "http://localhost:11434"),
			DefaultModel: task.Model.Name,
			ID:           "eval-ollama",
		}
		provider, err = llm.NewOllamaProvider(cfg)

	case "anthropic":
		cfg := llm.AnthropicConfig{
			APIKey:       task.Model.APIKey,
			DefaultModel: task.Model.Name,
			ID:           "eval-anthropic",
		}
		provider, err = llm.NewAnthropicProvider(cfg)

	case "openai":
		cfg := llm.OpenAIConfig{
			APIKey:       task.Model.APIKey,
			DefaultModel: task.Model.Name,
			ID:           "eval-openai",
		}
		provider, err = llm.NewOpenAIProvider(cfg)

	default:
		return EvaluationResult{
			Error:    fmt.Sprintf("Unsupported provider: %s", task.Model.Provider),
			Model:    task.Model.Name,
			Provider: task.Model.Provider,
		}
	}

	if err != nil {
		return EvaluationResult{
			Error:    err.Error(),
			Model:    task.Model.Name,
			Provider: task.Model.Provider,
		}
	}

	req := llm.CompletionRequest{
		AgentID: "eval-agent",
		Messages: []llm.Message{
			{Role: "user", Content: task.Prompt},
		},
		Model:       task.Model.Name,
		Temperature: getFloatOrDefault(task.Parameters.Temperature, 0.7),
		MaxTokens:   getIntOrDefault(task.Parameters.MaxTokens, 2048),
	}

	timeout := time.Duration(getIntOrDefault(task.Options.TimeoutMS, 60000)) * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	doneCh := make(chan struct{})
	var resp llm.CompletionResponse
	var completeErr error

	go func() {
		resp, completeErr = provider.Complete(req)
		close(doneCh)
	}()

	select {
	case <-doneCh:
		// Completion finished
	case <-ctx.Done():
		return EvaluationResult{
			Error:      fmt.Sprintf("Timeout after %dms", timeout.Milliseconds()),
			Model:      task.Model.Name,
			Provider:   task.Model.Provider,
			LatencyMS:  timeout.Milliseconds(),
			FinishReason: "timeout",
		}
	}

	latency := time.Since(start).Milliseconds()

	result := EvaluationResult{
		LatencyMS: latency,
		Model:     task.Model.Name,
		Provider:  task.Model.Provider,
	}

	if completeErr != nil {
		result.Error = completeErr.Error()
		result.FinishReason = "error"
		return result
	}

	result.Response = resp.Content
	result.TokensIn = resp.Usage.PromptTokens
	result.TokensOut = resp.Usage.CompletionTokens
	result.FinishReason = "stop"

	if task.Options.OutputPath != "" {
		if err := saveResult(task, result); err != nil && verbose {
			log.Printf("Warning: Failed to save result: %v", err)
		}
	}

	return result
}

func executeBatchTask(task BatchTask, parallel int, verbose bool) []EvaluationResult {
	results := make([]EvaluationResult, len(task.Tasks))
	taskChan := make(chan int, len(task.Tasks))
	var wg sync.WaitGroup

	for i := 0; i < parallel; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range taskChan {
				if verbose {
					fmt.Printf("  [%d/%d] %s on %s\n", idx+1, len(task.Tasks), 
						task.Tasks[idx].Model.Name, task.Tasks[idx].Model.Provider)
				}
				results[idx] = executeEvaluateTask(task.Tasks[idx], verbose)
				
				if results[idx].Error != "" && task.StopOnError {
					return
				}
			}
		}()
	}

	for i := range task.Tasks {
		taskChan <- i
	}
	close(taskChan)
	wg.Wait()

	return results
}

func saveResult(task EvaluateTask, result EvaluationResult) error {
	dir := filepath.Dir(task.Options.OutputPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var content string
	if task.Options.IncludeMetadata {
		tokensPerSec := float64(result.TokensOut) / (float64(result.LatencyMS) / 1000.0)
		content = fmt.Sprintf(`# LLM Evaluation Response

## Metadata

- **Model**: %s
- **Provider**: %s
- **Timestamp**: %s
- **Latency**: %dms
- **Tokens In**: %d
- **Tokens Out**: %d
- **Tokens/Second**: %.2f

---

## Response

%s
`, result.Model, result.Provider, time.Now().Format(time.RFC3339),
			result.LatencyMS, result.TokensIn, result.TokensOut, tokensPerSec, result.Response)
	} else {
		content = result.Response
	}

	return os.WriteFile(task.Options.OutputPath, []byte(content), 0644)
}

func printResult(result EvaluationResult) {
	fmt.Println("\n✅ Complete\n")
	fmt.Printf("Model:    %s\n", result.Model)
	fmt.Printf("Latency:  %dms\n", result.LatencyMS)
	fmt.Printf("Tokens:   %d in, %d out\n", result.TokensIn, result.TokensOut)
	
	if result.Error != "" {
		fmt.Printf("\n❌ Error: %s\n", result.Error)
	} else {
		fmt.Printf("\nResponse:\n%s\n", result.Response)
	}
}

func printBatchResults(results []EvaluationResult) {
	successful, failed := 0, 0
	var totalLatency int64
	var totalTokens int

	for _, r := range results {
		if r.Error == "" {
			successful++
			totalLatency += r.LatencyMS
			totalTokens += r.TokensOut
		} else {
			failed++
		}
	}

	fmt.Println("\n✅ Batch Complete\n")
	fmt.Printf("Total:      %d\n", len(results))
	fmt.Printf("Successful: %d\n", successful)
	fmt.Printf("Failed:     %d\n", failed)
	
	if successful > 0 {
		fmt.Printf("Avg Latency: %dms\n", totalLatency/int64(successful))
		fmt.Printf("Avg Tokens:  %d\n", totalTokens/successful)
	}
}

func getStringOrDefault(val, def string) string {
	if val == "" {
		return def
	}
	return val
}

func getFloatOrDefault(val, def float64) float64 {
	if val == 0 {
		return def
	}
	return val
}

func getIntOrDefault(val, def int) int {
	if val == 0 {
		return def
	}
	return val
}
