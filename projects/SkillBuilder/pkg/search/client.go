package search

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Provider defines the interface for search backends.
type Provider interface {
	Name() string
	Search(query string, maxResults int) (*SearchResult, error)
}

// TavilyClient implements the Provider interface for Tavily.
type TavilyClient struct {
	APIKey     string
	HTTPClient *http.Client
}

func (c *TavilyClient) Name() string {
	return "tavily"
}

func (c *TavilyClient) Search(query string, maxResults int) (*SearchResult, error) {
	start := time.Now()
	
	payload := map[string]interface{}{
		"api_key":         c.APIKey,
		"query":           query,
		"search_depth":    "basic",
		"max_results":     maxResults,
		"include_answer":  false,
		"include_raw_content": false,
	}
	
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequest("POST", "https://api.tavily.com/search", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tavily api error: %s", resp.Status)
	}
	
	var data struct {
		Results []struct {
			Title   string  `json:"title"`
			URL     string  `json:"url"`
			Content string  `json:"content"`
			Score   float64 `json:"score"`
		} `json:"results"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	
	hits := make([]SearchHit, 0, len(data.Results))
	for _, r := range data.Results {
		hits = append(hits, SearchHit{
			Title:    r.Title,
			URL:      r.URL,
			Snippet:  r.Content,
			Score:    r.Score,
			Provider: c.Name(),
		})
	}
	
	return &SearchResult{
		Query:      query,
		Hits:       hits,
		Provider:   c.Name(),
		RawCount:   len(hits),
		DurationMS: float64(time.Since(start).Milliseconds()),
	}, nil
}

// BraveClient implements the Provider interface for Brave.
type BraveClient struct {
	APIKey     string
	HTTPClient *http.Client
}

func (c *BraveClient) Name() string {
	return "brave"
}

func (c *BraveClient) Search(query string, maxResults int) (*SearchResult, error) {
	start := time.Now()
	
	req, err := http.NewRequest("GET", "https://api.search.brave.com/res/v1/web/search", nil)
	if err != nil {
		return nil, err
	}
	
	q := req.URL.Query()
	q.Add("q", query)
	q.Add("count", fmt.Sprintf("%d", maxResults))
	req.URL.RawQuery = q.Encode()
	
	req.Header.Set("X-Subscription-Token", c.APIKey)
	req.Header.Set("Accept", "application/json")
	
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("brave api error: %s", resp.Status)
	}
	
	var data struct {
		Web struct {
			Results []struct {
				Title       string `json:"title"`
				URL         string `json:"url"`
				Description string `json:"description"`
			} `json:"results"`
		} `json:"web"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	
	hits := make([]SearchHit, 0, len(data.Web.Results))
	for _, r := range data.Web.Results {
		hits = append(hits, SearchHit{
			Title:    r.Title,
			URL:      r.URL,
			Snippet:  SanitizeContent(r.Description),
			Provider: c.Name(),
		})
	}
	
	return &SearchResult{
		Query:      query,
		Hits:       hits,
		Provider:   c.Name(),
		RawCount:   len(hits),
		DurationMS: float64(time.Since(start).Milliseconds()),
	}, nil
}
