#!/bin/bash

# Mini-Miro Docker Build and Deploy Script
set -e

echo "🐳 Mini-Miro Docker Build & Deploy"
echo "=================================="

# Configuration
IMAGE_NAME="mini-miro"
IMAGE_TAG="latest"
COMPOSE_FILE="docker-compose.yml"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Create necessary directories
setup_directories() {
    log_step "Setting up directories..."
    
    mkdir -p data backups logs
    chmod 755 data backups logs
    
    log_info "Directories created: data/, backups/, logs/"
}

# Build Docker image
build_image() {
    log_step "Building Docker image..."
    
    # Clean up previous build artifacts
    docker system prune -f || true
    
    # Build with cache optimization
    docker build \
        --tag "$IMAGE_NAME:$IMAGE_TAG" \
        --build-arg NODE_ENV=production \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        . || {
        log_error "Docker build failed"
        exit 1
    }
    
    log_info "Docker image built: $IMAGE_NAME:$IMAGE_TAG"
    
    # Show image details
    docker images | grep "$IMAGE_NAME" | head -5
}

# Deploy with docker-compose
deploy() {
    log_step "Deploying with Docker Compose..."
    
    # Stop existing services
    docker-compose -f "$COMPOSE_FILE" down || true
    
    # Pull any external images
    docker-compose -f "$COMPOSE_FILE" pull || true
    
    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_info "Services started"
    
    # Show running containers
    docker-compose -f "$COMPOSE_FILE" ps
}

# Health check
health_check() {
    log_step "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts"
        
        if curl -f -s http://localhost:3003/health > /dev/null 2>&1; then
            log_info "✅ Application is healthy!"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "❌ Health check failed after $max_attempts attempts"
            
            # Show logs for debugging
            log_warn "Container logs:"
            docker-compose -f "$COMPOSE_FILE" logs --tail=20 mini-miro
            exit 1
        fi
        
        sleep 5
        ((attempt++))
    done
    
    # Test API endpoints
    log_info "Testing API endpoints..."
    
    if curl -f -s http://localhost:3003/api/diagrams > /dev/null; then
        log_info "✅ API endpoints responding"
    else
        log_warn "⚠️ API endpoints may not be ready yet"
    fi
}

# Show deployment info
show_info() {
    log_step "Deployment Information"
    echo "======================================"
    echo "🌐 Application URL: http://localhost:3003"
    echo "🏥 Health Check: http://localhost:3003/health"
    echo "📊 API Endpoint: http://localhost:3003/api/diagrams"
    echo "📁 Data Directory: $(pwd)/data"
    echo "💾 Backup Directory: $(pwd)/backups"
    echo "📝 Logs Directory: $(pwd)/logs"
    echo "======================================"
    
    # Show container status
    echo ""
    log_info "Container Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    
    # Show resource usage
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream mini-miro-app || true
}

# Cleanup function
cleanup() {
    log_step "Cleaning up..."
    
    # Remove dangling images
    docker image prune -f || true
    
    # Remove unused volumes (optional)
    # docker volume prune -f || true
    
    log_info "Cleanup completed"
}

# Main deployment function
main() {
    local action="${1:-build-deploy}"
    
    case "$action" in
        build)
            check_prerequisites
            setup_directories
            build_image
            ;;
        deploy)
            check_prerequisites
            setup_directories
            deploy
            health_check
            show_info
            ;;
        build-deploy)
            check_prerequisites
            setup_directories
            build_image
            deploy
            health_check
            show_info
            cleanup
            ;;
        health)
            health_check
            ;;
        info)
            show_info
            ;;
        clean)
            docker-compose -f "$COMPOSE_FILE" down
            docker system prune -f
            docker volume prune -f
            log_info "Complete cleanup finished"
            ;;
        *)
            echo "Usage: $0 {build|deploy|build-deploy|health|info|clean}"
            echo "  build        - Build Docker image only"
            echo "  deploy       - Deploy with Docker Compose only"
            echo "  build-deploy - Build and deploy (default)"
            echo "  health       - Run health checks"
            echo "  info         - Show deployment information"
            echo "  clean        - Clean up containers and images"
            exit 1
            ;;
    esac
}

# Trap for cleanup on script exit
trap 'log_warn "Script interrupted"' INT TERM

# Run main function
main "$@"

log_info "🎉 Script completed successfully!"