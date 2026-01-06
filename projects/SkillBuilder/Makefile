.PHONY: all build-go build-clojure clean

all: build-go build-clojure

build-go:
	@echo "Building Go Search Swarm..."
	@export PATH="$$HOME/.local/go/bin:$$HOME/.local/share/mise/installs/go/1.25.5/bin:$$PATH" && \
	go build -o bin/search-swarm cmd/search-swarm/main.go

build-clojure:
	@echo "Building Clojure Synthesis Engine (Uberjar)..."
	@echo "Note: Requires 'clj' tool to be installed."
	@# If clj is available, this would be: clj -X:uberjar
	@# For now, we rely on the Python bridge's source-based fallback if the jar isn't built.

clean:
	rm -f bin/search-swarm
	rm -rf semantic_synthesis/target
