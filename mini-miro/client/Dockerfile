# Multi-stage build for React client
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy build files to Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Install curl for health check
RUN apk add --no-cache curl

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]