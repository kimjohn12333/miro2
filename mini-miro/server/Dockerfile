FROM node:20-alpine

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Install curl for health check
RUN apk add --no-cache curl

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]