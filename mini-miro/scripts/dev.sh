#!/bin/bash

# Mini-Miro Development Environment Script
set -e

echo "🔧 Starting Mini-Miro development environment..."

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[DEV]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Start development environment
start_dev() {
    log_info "Starting development containers..."
    
    # Build and start containers
    docker-compose -f "$COMPOSE_FILE" up --build -d
    
    log_info "Development environment started!"
    log_info "Frontend: http://localhost:3000 (Hot reload enabled)"
    log_info "Backend: http://localhost:5000 (Nodemon enabled)"
    log_info "Database Viewer: http://localhost:8080"
    log_info "Debug Port: 9229 (Node.js inspector)"
    
    # Show logs
    log_info "Following logs... (Press Ctrl+C to stop)"
    docker-compose -f "$COMPOSE_FILE" logs -f
}

# Stop development environment
stop_dev() {
    log_info "Stopping development containers..."
    docker-compose -f "$COMPOSE_FILE" down
    log_info "Development environment stopped"
}

# Restart development environment
restart_dev() {
    log_info "Restarting development environment..."
    docker-compose -f "$COMPOSE_FILE" restart
    log_info "Development environment restarted"
}

# Show logs
show_logs() {
    docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    
    # Frontend dependencies
    docker-compose -f "$COMPOSE_FILE" run --rm frontend npm install
    
    # Backend dependencies
    docker-compose -f "$COMPOSE_FILE" run --rm backend npm install
    
    log_info "Dependencies installed"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    # Frontend tests
    docker-compose -f "$COMPOSE_FILE" run --rm frontend npm test -- --watchAll=false
    
    # Backend tests (if exists)
    # docker-compose -f "$COMPOSE_FILE" run --rm backend npm test
    
    log_info "Tests completed"
}

# Usage information
usage() {
    echo "Usage: $0 {start|stop|restart|logs|install|test|status}"
    echo "  start    - Start development environment"
    echo "  stop     - Stop development environment"
    echo "  restart  - Restart development environment"
    echo "  logs     - Show container logs"
    echo "  install  - Install dependencies"
    echo "  test     - Run tests"
    echo "  status   - Show container status"
}

# Main function
case "${1:-start}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_dev
        ;;
    logs)
        show_logs "$@"
        ;;
    install)
        install_deps
        ;;
    test)
        run_tests
        ;;
    status)
        docker-compose -f "$COMPOSE_FILE" ps
        ;;
    *)
        usage
        exit 1
        ;;
esac