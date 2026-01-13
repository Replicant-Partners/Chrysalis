# Chrysalis Multi-Stage Dockerfile
# Supports both TypeScript and Python components
#
# Build stages:
# 1. node-builder: Builds TypeScript components
# 2. python-builder: Installs Python dependencies
# 3. runtime: Combined runtime image
#
# @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-3

# =============================================================================
# Stage 1: Node.js Builder
# =============================================================================
FROM node:20-slim AS node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# =============================================================================
# Stage 2: Python Builder
# =============================================================================
FROM python:3.11-slim AS python-builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements*.txt ./
COPY pyproject.toml ./

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --no-cache-dir -e . 2>/dev/null || true

# Copy Python source
COPY memory_system/ ./memory_system/
COPY shared/ ./shared/
COPY projects/ ./projects/

# =============================================================================
# Stage 3: Runtime Image
# =============================================================================
FROM node:20-slim AS runtime

# Install Python runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node.js built artifacts
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package*.json ./

# Copy Python virtual environment
COPY --from=python-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy Python source files
COPY --from=python-builder /app/memory_system ./memory_system
COPY --from=python-builder /app/shared ./shared
COPY --from=python-builder /app/projects ./projects

# Copy additional configuration files
COPY pyproject.toml ./

# Create non-root user for security
RUN groupadd -r chrysalis && useradd -r -g chrysalis chrysalis && \
    chown -R chrysalis:chrysalis /app

USER chrysalis

# Expose service ports
# Gateway: 3000, Ledger: 3001, Projection: 3002, Grounding: 3003, Skillforge: 3004
# Metrics: 9090
EXPOSE 3000 3001 3002 3003 3004 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command (can be overridden)
CMD ["node", "dist/services/capability-gateway/run-gateway.js"]

# =============================================================================
# Labels for container metadata
# =============================================================================
LABEL org.opencontainers.image.title="Chrysalis"
LABEL org.opencontainers.image.description="Uniform Semantic Agent Morphing System"
LABEL org.opencontainers.image.version="3.1.0"
LABEL org.opencontainers.image.vendor="Chrysalis Project"
LABEL org.opencontainers.image.source="https://github.com/chrysalis-project/chrysalis"