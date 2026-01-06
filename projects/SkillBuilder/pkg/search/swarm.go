package search

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Swarm orchestrates the two-stage search process.
type Swarm struct {
	Spec      SearchSpec
	Providers []Provider
}

// NewSwarm creates a new Swarm instance.
func NewSwarm(spec SearchSpec) *Swarm {
	httpClient := &http.Client{Timeout: 30 * time.Second}
	providers := []Provider{}
	
	if spec.TavilyAPIKey != "" {
		providers = append(providers, &TavilyClient{APIKey: spec.TavilyAPIKey, HTTPClient: httpClient})
	}
	if spec.BraveAPIKey != "" {
		providers = append(providers, &BraveClient{APIKey: spec.BraveAPIKey, HTTPClient: httpClient})
	}
	
	return &Swarm{
		Spec:      spec,
		Providers: providers,
	}
}

// Run executes the full two-stage search.
func (s *Swarm) Run() (*SwarmResult, error) {
	// Stage 1: Exemplar-focused research
	stage1Results, err := s.runStage1()
	if err != nil {
		return nil, err
	}
	
	stage1Hits := s.aggregateHits(stage1Results)
	domainAnchors := s.inferDomainAnchors(stage1Hits)
	
	// Stage 2: Standards and reference model sweep
	stage2Results, err := s.runStage2(domainAnchors)
	if err != nil {
		return nil, err
	}
	
	stage2Hits := s.aggregateHits(stage2Results)
	allHits := s.deduplicateAndRank(append(stage1Hits, stage2Hits...))
	
	return &SwarmResult{
		Stage1Results: stage1Results,
		Stage2Results: stage2Results,
		AllHits:       allHits,
		DomainAnchors: domainAnchors,
		Timestamp:     time.Now(),
	}, nil
}

func (s *Swarm) runStage1() ([]SearchResult, error) {
	field := s.extractField()
	var queries []string

	for _, exemplar := range s.Spec.Exemplars {
		for _, template := range s.Spec.QueryTemplates {
			query := strings.ReplaceAll(template, "{name}", exemplar.Name)
			query = strings.ReplaceAll(query, "{field}", field)
			queries = append(queries, query)
		}
	}

	return s.executeSwarm(queries, s.Spec.SearchMaxResultsPerQuery)
}

func (s *Swarm) runStage2(anchors []string) ([]SearchResult, error) {
	field := s.extractField()
	var queries []string

	// Stage 2 templates
	for _, template := range s.Spec.Stage2QueryTemplates {
		query := strings.ReplaceAll(template, "{field}", field)
		queries = append(queries, query)
	}

	// Anchor queries
	for _, anchor := range anchors {
		queries = append(queries, fmt.Sprintf("%s standards reference model", anchor))
	}

	return s.executeSwarm(queries, s.Spec.SearchMaxResultsPerQuery)
}

func (s *Swarm) executeSwarm(queries []string, maxResults int) ([]SearchResult, error) {
	resultsChan := make(chan SearchResult, len(queries)*len(s.Providers))
	var wg sync.WaitGroup

	for _, query := range queries {
		for _, p := range s.Providers {
			wg.Add(1)
			go func(p Provider, q string) {
				defer wg.Done()
				res, err := p.Search(q, maxResults)
				if err == nil && res != nil {
					resultsChan <- *res
				}
			}(p, query)
		}
	}

	// Close channel once all goroutines finish
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	var results []SearchResult
	for res := range resultsChan {
		results = append(results, res)
	}

	return results, nil
}

func (s *Swarm) extractField() string {
	parts := strings.Fields(s.Spec.Purpose)
	if len(parts) > 5 {
		parts = parts[:5]
	}
	field := strings.Join(parts, " ")
	if len(s.Spec.Skills) > 0 {
		field = fmt.Sprintf("%s %s", field, s.Spec.Skills[0])
	}
	return field
}

func (s *Swarm) aggregateHits(results []SearchResult) []SearchHit {
	var hits []SearchHit
	for _, res := range results {
		hits = append(hits, res.Hits...)
	}
	return hits
}

func (s *Swarm) deduplicateAndRank(hits []SearchHit) []SearchHit {
	seen := make(map[string]bool)
	var unique []SearchHit
	for _, h := range hits {
		if !seen[h.URL] {
			seen[h.URL] = true
			unique = append(unique, h) // Simplified ranking for now
		}
	}
	return unique
}

func (s *Swarm) inferDomainAnchors(hits []SearchHit) []string {
	// Simplified anchor inference
	anchors := make(map[string]bool)
	for _, h := range hits {
		if strings.Contains(strings.ToLower(h.Title), "institute") || 
		   strings.Contains(strings.ToLower(h.Title), "association") ||
		   strings.Contains(strings.ToLower(h.Title), "standard") {
			anchors[h.Title] = true
		}
	}
	
	var result []string
	for a := range anchors {
		result = append(result, a)
		if len(result) >= 10 {
			break
		}
	}
	return result
}
