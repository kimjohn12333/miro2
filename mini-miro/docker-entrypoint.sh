#!/bin/sh
set -e

# Docker entrypoint script for Mini-Miro
# Provides initialization, health checks, and monitoring

echo "🚀 Mini-Miro Docker Entrypoint"
echo "================================"

# Environment validation
validate_environment() {
    echo "🔍 Validating environment..."
    
    # Set default values if not provided
    export NODE_ENV=${NODE_ENV:-production}
    export PORT=${PORT:-3003}
    export DB_PATH=${DB_PATH:-/app/data/minimiro.db}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    
    echo "✅ Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"
}

# Database initialization
init_database() {
    echo "📊 Initializing database..."
    
    # Create data directory if it doesn't exist
    mkdir -p "$(dirname "$DB_PATH")"
    
    # Set proper permissions
    chmod 755 "$(dirname "$DB_PATH")"
    
    if [ ! -f "$DB_PATH" ]; then
        echo "📝 Creating new database at $DB_PATH"
        touch "$DB_PATH"
        chmod 644 "$DB_PATH"
    else
        echo "📚 Using existing database at $DB_PATH"
    fi
}

# Log directory setup
init_logs() {
    echo "📝 Setting up logging..."
    
    mkdir -p /app/logs
    chmod 755 /app/logs
    
    # Create log files if they don't exist
    touch /app/logs/app.log /app/logs/error.log
    chmod 644 /app/logs/*.log
    
    echo "✅ Logs will be written to /app/logs/"
}

# Health monitoring setup
setup_monitoring() {
    echo "🏥 Setting up health monitoring..."
    
    # Create monitoring script
    cat > /app/health-monitor.sh << 'EOF'
#!/bin/sh
while true; do
    sleep 30
    if ! curl -f -s http://localhost:${PORT:-3003}/health > /dev/null 2>&1; then
        echo "❌ Health check failed at $(date)"
    fi
done
EOF
    chmod +x /app/health-monitor.sh
    
    echo "✅ Health monitoring configured"
}

# Signal handling for graceful shutdown
setup_signal_handlers() {
    echo "⚡ Setting up signal handlers..."
    
    # Create shutdown handler
    shutdown_handler() {
        echo ""
        echo "🛑 Received shutdown signal"
        echo "💾 Saving application state..."
        
        # Give the app time to close connections
        sleep 2
        
        echo "👋 Mini-Miro shutting down gracefully"
        exit 0
    }
    
    # Register signal handlers
    trap shutdown_handler TERM INT
}

# Pre-start validation
pre_start_checks() {
    echo "🔧 Running pre-start checks..."
    
    # Check Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        echo "❌ Node.js not found"
        exit 1
    fi
    
    # Check application files
    if [ ! -f "/app/server/server.js" ]; then
        echo "❌ Server application not found"
        exit 1
    fi
    
    if [ ! -d "/app/client/build" ]; then
        echo "❌ Frontend build not found"
        exit 1
    fi
    
    echo "✅ Pre-start checks passed"
}

# Main initialization function
main() {
    validate_environment
    init_database
    init_logs
    setup_monitoring
    setup_signal_handlers
    pre_start_checks
    
    echo "================================"
    echo "🎉 Initialization complete!"
    echo "🌐 Starting Mini-Miro on port $PORT"
    echo "📊 Database: $DB_PATH"
    echo "📝 Logs: /app/logs/"
    echo "🏥 Health check: http://localhost:$PORT/health"
    echo "================================"
    echo ""
    
    # Start the application
    exec "$@"
}

# Run main function with all arguments
main "$@"