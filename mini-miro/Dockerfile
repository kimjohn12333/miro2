# Multi-stage Dockerfile for Mini-Miro Diagram App
# Combines frontend and backend in a single optimized container

# =============================================================================
# Stage 1: Frontend Build (React)
# =============================================================================
FROM node:20-alpine AS frontend-build

# Set working directory for frontend
WORKDIR /app/frontend

# Copy package files for dependency caching
COPY client/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Copy frontend source code
COPY client/ ./

# Set React environment variables for production build
# Use empty string to make the app use relative URLs to the same host/port
ENV REACT_APP_API_URL=""

# Build production frontend
RUN npm run build

# =============================================================================
# Stage 2: Backend Dependencies
# =============================================================================
FROM node:20-alpine AS backend-deps

# Set working directory for backend
WORKDIR /app/backend

# Copy backend package files
COPY server/package*.json ./

# Install backend dependencies with security and performance optimizations
RUN npm ci --only=production --silent && \
    npm cache clean --force && \
    # Remove unnecessary files to reduce image size
    find node_modules -type f -name "*.md" -delete && \
    find node_modules -type f -name "*.txt" -delete && \
    find node_modules -type d -name "test*" -exec rm -rf {} + 2>/dev/null || true

# =============================================================================
# Stage 3: Production Runtime
# =============================================================================
FROM node:20-alpine AS production

# Install runtime dependencies and security tools
RUN apk add --no-cache \
    curl \
    ca-certificates \
    dumb-init \
    sqlite \
    && rm -rf /var/cache/apk/*

# Create application directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S -u 1001 -G appgroup appuser

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/client/build /app/server && \
    chown -R appuser:appgroup /app

# Copy backend dependencies from previous stage
COPY --from=backend-deps --chown=appuser:appgroup /app/backend/node_modules ./server/node_modules

# Copy backend source code
COPY --chown=appuser:appgroup server/ ./server/

# Copy frontend build from previous stage
COPY --from=frontend-build --chown=appuser:appgroup /app/frontend/build ./client/build

# Create startup script for initialization
RUN echo '#!/bin/sh\n\
set -e\n\
\n\
echo "Starting Mini-Miro Application..."\n\
\n\
# Environment validation\n\
if [ -z "$NODE_ENV" ]; then\n\
    export NODE_ENV=production\n\
fi\n\
\n\
# Database initialization\n\
if [ ! -f "/app/data/minimiro.db" ]; then\n\
    echo "Initializing database..."\n\
    mkdir -p /app/data\n\
fi\n\
\n\
# Log directory setup\n\
mkdir -p /app/logs\n\
\n\
# Health check endpoint setup\n\
echo "Health check available at http://localhost:${PORT:-3003}/health"\n\
\n\
# Start the application with proper signal handling\n\
echo "Application starting on port ${PORT:-3003}..."\n\
exec node server/server.js' > /app/start.sh && \
    chmod +x /app/start.sh && \
    chown appuser:appgroup /app/start.sh

# Switch to non-root user
USER appuser

# Set environment variables with secure defaults
ENV NODE_ENV=production \
    PORT=3003 \
    DB_PATH=/app/data/minimiro.db \
    LOG_LEVEL=info \
    NPM_CONFIG_PRODUCTION=true \
    NODE_OPTIONS="--max-old-space-size=512"

# Expose application port
EXPOSE 3003

# Health check configuration
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries=3 \
    CMD curl -f http://localhost:${PORT:-3003}/health || exit 1

# Define volumes for data persistence
VOLUME ["/app/data", "/app/logs"]

# Copy and use the entrypoint script
COPY --chown=appuser:appgroup docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "/app/docker-entrypoint.sh"]

# Start the application
CMD ["node", "server/server.js"]

# =============================================================================
# Metadata and Labels
# =============================================================================
LABEL maintainer="Mini-Miro Team" \
      version="1.0.0" \
      description="Complete Mini-Miro diagram application with React frontend and Node.js backend" \
      org.opencontainers.image.title="Mini-Miro" \
      org.opencontainers.image.description="Collaborative diagram editor with real-time features" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Mini-Miro Team" \
      org.opencontainers.image.schema-version="1.0"