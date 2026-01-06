package search

import (
	"regexp"
	"strings"
)

var injectionPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(ignore|disregard|forget)\s+(previous|prior|above|all)\s+(instructions?|prompts?|context)\b`),
	regexp.MustCompile(`(?i)\bnew\s+instructions?\s*[:;]\s*`),
	regexp.MustCompile(`(?i)\bsystem\s*[:;]\s*you\s+are\b`),
	regexp.MustCompile(`(?i)\byou\s+are\s+now\b`),
	regexp.MustCompile(`(?i)\bact\s+as\s+(a|an|if)\b`),
	regexp.MustCompile(`(?i)\bpretend\s+(to\s+be|you\s+are)\b`),
}

// SanitizeContent removes potential prompt injection patterns from text.
func SanitizeContent(text string) string {
	result := text
	for _, pattern := range injectionPatterns {
		result = pattern.ReplaceAllString(result, "[REDACTED_INSTRUCTION]")
	}
	
	// Normalize whitespace
	result = strings.Join(strings.Fields(result), " ")
	
	return result
}
