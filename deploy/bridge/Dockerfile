# Chrysalis Universal Agent Bridge
# Multi-stage Docker build for production deployment

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY shared/ ./shared/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# =============================================================================
# Stage 2: Production Runtime
# =============================================================================
FROM node:20-alpine AS runtime

# Security: Run as non-root user
RUN addgroup -g 1001 -S chrysalis && \
    adduser -S bridge -u 1001 -G chrysalis

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    tini

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy API specs
COPY src/api/bridge/openapi.yaml ./api/openapi.yaml
COPY src/api/grpc/bridge.proto ./api/bridge.proto

# Set ownership
RUN chown -R bridge:chrysalis /app

# Switch to non-root user
USER bridge

# Environment configuration
ENV NODE_ENV=production
ENV BRIDGE_PORT=3100
ENV BRIDGE_HOST=0.0.0.0
ENV BRIDGE_LOG_LEVEL=info
ENV BRIDGE_HEALTH_CHECK_INTERVAL=60000
ENV BRIDGE_MAX_EVENT_HISTORY=1000

# Expose ports
# REST API
EXPOSE 3100
# gRPC (future)
EXPOSE 3101
# Prometheus metrics
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${BRIDGE_PORT}/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the bridge service
CMD ["node", "dist/api/bridge/server.js"]

# =============================================================================
# Labels
# =============================================================================
LABEL org.opencontainers.image.title="Chrysalis Universal Agent Bridge"
LABEL org.opencontainers.image.description="Cross-framework agent translation service"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Chrysalis Project"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/chrysalis-project/chrysalis"
