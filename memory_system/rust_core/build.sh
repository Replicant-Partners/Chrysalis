#!/bin/bash
# Build script for Chrysalis Memory Rust Core
#
# Usage:
#   ./build.sh          # Development build + install
#   ./build.sh release  # Release build (wheel)
#   ./build.sh test     # Run tests
#   ./build.sh clean    # Clean build artifacts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."

    # Check Rust
    if ! command -v cargo &> /dev/null; then
        log_error "Rust not found. Install from https://rustup.rs/"
        exit 1
    fi
    log_info "  Rust: $(cargo --version)"

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 not found"
        exit 1
    fi
    log_info "  Python: $(python3 --version)"

    # Check maturin
    if ! command -v maturin &> /dev/null; then
        log_warn "maturin not found, installing..."
        pip install maturin
    fi
    log_info "  maturin: $(maturin --version)"
}

build_dev() {
    log_info "Building development version..."
    check_dependencies

    # Build and install in development mode
    maturin develop

    log_info "Build complete! Module installed in development mode."
    log_info "Test with: python -c 'from chrysalis_memory import GSet; print(GSet())'"
}

build_release() {
    log_info "Building release wheel..."
    check_dependencies

    # Build optimized wheel
    maturin build --release

    WHEEL=$(ls -t target/wheels/*.whl | head -1)
    log_info "Build complete! Wheel: $WHEEL"
    log_info "Install with: pip install $WHEEL"
}

run_tests() {
    log_info "Running tests..."

    # First ensure module is built
    if ! python3 -c "from chrysalis_memory import GSet" 2>/dev/null; then
        log_warn "Module not installed, building first..."
        build_dev
    fi

    # Run pytest
    if command -v pytest &> /dev/null; then
        pytest tests/ -v
    else
        log_warn "pytest not found, installing..."
        pip install pytest pytest-asyncio
        pytest tests/ -v
    fi
}

clean() {
    log_info "Cleaning build artifacts..."
    cargo clean
    rm -rf target/
    rm -rf *.egg-info/
    rm -rf .pytest_cache/
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    log_info "Clean complete!"
}

case "${1:-dev}" in
    dev|develop)
        build_dev
        ;;
    release)
        build_release
        ;;
    test)
        run_tests
        ;;
    clean)
        clean
        ;;
    check)
        check_dependencies
        cargo check
        ;;
    *)
        echo "Usage: $0 {dev|release|test|clean|check}"
        echo ""
        echo "Commands:"
        echo "  dev      Build and install in development mode (default)"
        echo "  release  Build optimized wheel for distribution"
        echo "  test     Run pytest test suite"
        echo "  clean    Remove build artifacts"
        echo "  check    Check dependencies and compile"
        exit 1
        ;;
esac
