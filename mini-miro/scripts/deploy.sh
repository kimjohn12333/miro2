#!/bin/bash

# Mini-Miro Production Deployment Script
set -e

echo "🚀 Starting Mini-Miro deployment..."

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
BACKUP_DIR="./backups"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warn "Environment file not found. Creating from example..."
        cp .env.example .env
        log_warn "Please update .env file with your configuration"
        exit 1
    fi
    
    log_info "Prerequisites check completed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    if docker volume ls | grep -q mini-miro-database; then
        BACKUP_NAME="backup-$(date +%Y%m%d_%H%M%S).tar.gz"
        docker run --rm \
            -v mini-miro-database:/data:ro \
            -v "$(pwd)/$BACKUP_DIR":/backup \
            alpine:latest \
            tar czf "/backup/$BACKUP_NAME" -C /data .
        log_info "Backup created: $BACKUP_DIR/$BACKUP_NAME"
    else
        log_warn "No existing volume found, skipping backup"
    fi
}

# Build and deploy
deploy() {
    log_info "Building and deploying containers..."
    
    # Pull latest images
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Build containers
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    
    # Stop existing containers
    docker-compose -f "$COMPOSE_FILE" down
    
    # Start new containers
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_info "Deployment completed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    sleep 30  # Wait for services to start
    
    # Check backend health
    if curl -f http://localhost:5000/health &> /dev/null; then
        log_info "Backend health check passed"
    else
        log_error "Backend health check failed"
        exit 1
    fi
    
    # Check frontend
    if curl -f http://localhost/ &> /dev/null; then
        log_info "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        exit 1
    fi
    
    log_info "All health checks passed"
}

# Main deployment flow
main() {
    check_prerequisites
    create_backup
    deploy
    health_check
    
    log_info "🎉 Deployment successful!"
    log_info "Frontend: http://localhost"
    log_info "Backend API: http://localhost:5000"
    
    # Show status
    docker-compose -f "$COMPOSE_FILE" ps
}

# Run main function
main "$@"