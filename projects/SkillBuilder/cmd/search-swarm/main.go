package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/Replicant-Partners/SkillBuilder/pkg/search"
)

func main() {
	specPath := flag.String("spec", "", "Path to search spec JSON")
	flag.Parse()

	if *specPath == "" {
		fmt.Fprintln(os.Stderr, "Error: -spec is required")
		os.Exit(1)
	}

	data, err := os.ReadFile(*specPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading spec: %v\n", err)
		os.Exit(1)
	}

	var spec search.SearchSpec
	if err := json.Unmarshal(data, &spec); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing spec: %v\n", err)
		os.Exit(1)
	}

	swarm := search.NewSwarm(spec)
	result, err := swarm.Run()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error running swarm: %v\n", err)
		os.Exit(1)
	}

	output, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling result: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}
