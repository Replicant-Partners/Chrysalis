# Chrysalis Native Modules Build System
#
# Builds all native language modules:
# - Rust WASM: Cryptographic operations
# - OCaml: CRDT implementations
# - Go: Consensus and gossip
# - Datalog: Flow graph specification

.PHONY: all clean rust ocaml go datalog test install-deps

# Default target
all: rust ocaml go datalog

# ============================================================================
# Rust WASM Crypto Module
# ============================================================================

RUST_DIR := rust-crypto
RUST_OUT := $(RUST_DIR)/pkg

rust: $(RUST_OUT)/chrysalis_crypto.js

$(RUST_OUT)/chrysalis_crypto.js: $(RUST_DIR)/src/lib.rs $(RUST_DIR)/Cargo.toml
	@echo "Building Rust WASM crypto module..."
	cd $(RUST_DIR) && wasm-pack build --target web --out-dir pkg
	@echo "Rust WASM build complete"

rust-test:
	@echo "Testing Rust crypto module..."
	cd $(RUST_DIR) && cargo test
	cd $(RUST_DIR) && wasm-pack test --node

rust-clean:
	cd $(RUST_DIR) && cargo clean
	rm -rf $(RUST_OUT)

# ============================================================================
# OCaml CRDT Module
# ============================================================================

OCAML_DIR := ocaml-crdt
OCAML_OUT := $(OCAML_DIR)/_build/default

ocaml: $(OCAML_OUT)/lib/chrysalis_crdt.cma

$(OCAML_OUT)/lib/chrysalis_crdt.cma: $(OCAML_DIR)/lib/*.ml $(OCAML_DIR)/dune-project
	@echo "Building OCaml CRDT module..."
	cd $(OCAML_DIR) && dune build
	@echo "OCaml build complete"

ocaml-js: ocaml
	@echo "Compiling OCaml to JavaScript..."
	cd $(OCAML_DIR) && dune build --force ./lib/chrysalis_crdt.bc.js
	@echo "OCaml JS compilation complete"

ocaml-test:
	@echo "Testing OCaml CRDT module..."
	cd $(OCAML_DIR) && dune runtest

ocaml-clean:
	cd $(OCAML_DIR) && dune clean

# ============================================================================
# Go Consensus Module
# ============================================================================

GO_DIR := go-consensus
GO_OUT := $(GO_DIR)/bin

go: $(GO_OUT)/consensus-server

$(GO_OUT)/consensus-server: $(GO_DIR)/cmd/server/main.go $(GO_DIR)/pkg/**/*.go
	@echo "Building Go consensus module..."
	mkdir -p $(GO_OUT)
	cd $(GO_DIR) && go build -o bin/consensus-server ./cmd/server
	@echo "Go build complete"

go-test:
	@echo "Testing Go consensus module..."
	cd $(GO_DIR) && go test ./...

go-run: go
	@echo "Starting Go consensus server..."
	$(GO_OUT)/consensus-server --node-id=local-001 --addr=:8080

go-clean:
	rm -rf $(GO_OUT)
	cd $(GO_DIR) && go clean -cache

# ============================================================================
# Datalog Flow Specification
# ============================================================================

DATALOG_DIR := datalog-flow
DATALOG_OUT := $(DATALOG_DIR)/build

datalog: $(DATALOG_OUT)/flow

$(DATALOG_OUT)/flow: $(DATALOG_DIR)/flow.dl
	@echo "Compiling Datalog flow specification..."
	mkdir -p $(DATALOG_OUT)
	@if command -v souffle &> /dev/null; then \
		souffle -c $(DATALOG_DIR)/flow.dl -o $(DATALOG_OUT)/flow; \
		echo "Datalog compilation complete"; \
	else \
		echo "Soufflé not installed - using Python fallback runtime"; \
		touch $(DATALOG_OUT)/flow; \
	fi

datalog-test:
	@echo "Testing Datalog flow engine..."
	cd $(DATALOG_DIR)/runtime && python -m pytest engine.py -v 2>/dev/null || \
		python $(DATALOG_DIR)/runtime/engine.py

datalog-clean:
	rm -rf $(DATALOG_OUT)

# ============================================================================
# TypeScript Bindings
# ============================================================================

bindings-test:
	@echo "Testing TypeScript bindings..."
	cd ../.. && npm run test -- --filter native

bindings-typecheck:
	@echo "Type-checking bindings..."
	cd bindings && npx tsc --noEmit

# ============================================================================
# Integration Tests
# ============================================================================

test: rust-test ocaml-test go-test datalog-test bindings-test
	@echo "All tests complete"

test-integration:
	@echo "Running integration tests..."
	cd ../.. && npm run test -- src/native/tests/integration.test.ts

# ============================================================================
# Dependencies
# ============================================================================

install-deps:
	@echo "Installing build dependencies..."
	@echo ""
	@echo "Rust (wasm-pack):"
	@command -v wasm-pack &> /dev/null || cargo install wasm-pack
	@echo ""
	@echo "OCaml (opam + dune):"
	@command -v opam &> /dev/null || echo "Install opam: https://opam.ocaml.org/doc/Install.html"
	@command -v dune &> /dev/null || opam install dune
	@echo ""
	@echo "Go:"
	@command -v go &> /dev/null || echo "Install Go: https://go.dev/doc/install"
	@echo ""
	@echo "Datalog (Soufflé):"
	@command -v souffle &> /dev/null || echo "Install Soufflé: https://souffle-lang.github.io/install"
	@echo ""
	@echo "Dependency check complete"

check-deps:
	@echo "Checking dependencies..."
	@echo -n "Rust: " && (command -v cargo &> /dev/null && cargo --version || echo "NOT INSTALLED")
	@echo -n "wasm-pack: " && (command -v wasm-pack &> /dev/null && wasm-pack --version || echo "NOT INSTALLED")
	@echo -n "OCaml: " && (command -v ocaml &> /dev/null && ocaml --version || echo "NOT INSTALLED")
	@echo -n "Dune: " && (command -v dune &> /dev/null && dune --version || echo "NOT INSTALLED")
	@echo -n "Go: " && (command -v go &> /dev/null && go version || echo "NOT INSTALLED")
	@echo -n "Soufflé: " && (command -v souffle &> /dev/null && souffle --version || echo "NOT INSTALLED (optional)")

# ============================================================================
# Clean
# ============================================================================

clean: rust-clean ocaml-clean go-clean datalog-clean
	@echo "Clean complete"

# ============================================================================
# Development
# ============================================================================

dev: all
	@echo "Development build complete"
	@echo ""
	@echo "Native modules built:"
	@echo "  - Rust WASM: $(RUST_OUT)/"
	@echo "  - OCaml: $(OCAML_OUT)/"
	@echo "  - Go: $(GO_OUT)/"
	@echo "  - Datalog: $(DATALOG_OUT)/"
	@echo ""
	@echo "To start the consensus server:"
	@echo "  make go-run"
	@echo ""
	@echo "To run tests:"
	@echo "  make test"

# Help
help:
	@echo "Chrysalis Native Modules Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all          - Build all native modules"
	@echo "  rust         - Build Rust WASM crypto module"
	@echo "  ocaml        - Build OCaml CRDT module"
	@echo "  go           - Build Go consensus module"
	@echo "  datalog      - Compile Datalog flow specification"
	@echo ""
	@echo "  test         - Run all tests"
	@echo "  clean        - Clean all build artifacts"
	@echo ""
	@echo "  install-deps - Install build dependencies"
	@echo "  check-deps   - Check installed dependencies"
	@echo ""
	@echo "  go-run       - Start Go consensus server"
	@echo "  dev          - Development build with info"
	@echo ""
	@echo "  help         - Show this help message"