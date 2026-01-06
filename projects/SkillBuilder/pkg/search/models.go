package search

import "time"

// SearchHit represents a single result from a search provider.
type SearchHit struct {
	Title    string  `json:"title"`
	URL      string  `json:"url"`
	Snippet  string  `json:"snippet"`
	Score    float64 `json:"score"`
	Domain   string  `json:"domain"`
	Provider string  `json:"provider"`
}

// SearchResult represents the aggregated results of a search query.
type SearchResult struct {
	Query      string      `json:"query"`
	Hits       []SearchHit `json:"hits"`
	Provider   string      `json:"provider"`
	RawCount   int         `json:"raw_count"`
	DurationMS float64     `json:"duration_ms"`
	Error      string      `json:"error,omitempty"`
}

// Exemplar represents a person or entity to research.
type Exemplar struct {
	Name     string   `json:"name"`
	URL      string   `json:"url,omitempty"`
	IsAuthor bool     `json:"is_author"`
	Salts    []string `json:"salts,omitempty"`
}

// SearchSpec defines the parameters for the search swarm.
type SearchSpec struct {
	ModeName                     string     `json:"mode_name"`
	Purpose                      string     `json:"purpose"`
	Skills                       []string   `json:"skills"`
	Exemplars                    []Exemplar `json:"exemplars"`
	QueryTemplates               []string   `json:"query_templates"`
	Stage2QueryTemplates         []string   `json:"stage2_query_templates"`
	SearchMaxResultsPerQuery     int        `json:"search_max_results_per_query"`
	TavilyAPIKey                 string     `json:"tavily_api_key,omitempty"`
	BraveAPIKey                  string     `json:"brave_api_key,omitempty"`
}

// SwarmResult is the final output of the two-stage search.
type SwarmResult struct {
	Stage1Results []SearchResult `json:"stage1_results"`
	Stage2Results []SearchResult `json:"stage2_results"`
	AllHits       []SearchHit    `json:"all_hits"`
	InferredSkills []string      `json:"inferred_skills"`
	DomainAnchors  []string      `json:"domain_anchors"`
	Timestamp      time.Time      `json:"timestamp"`
}
