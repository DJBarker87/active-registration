#!/bin/bash
set -e

# Active Registration - Installation Script
# This script sets up the cron job to run notifications every minute

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Active Registration Installation ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js 18 or later: https://nodejs.org"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js version 18 or later is required"
    echo "Current version: $(node -v)"
    exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    exit 1
fi
echo "  ✓ npm $(npm -v)"

echo ""

# Verify project files
echo "Verifying project files..."

if [ ! -f "$PROJECT_DIR/src/index.js" ]; then
    echo "ERROR: src/index.js not found"
    exit 1
fi
echo "  ✓ src/index.js"

if [ ! -f "$PROJECT_DIR/config/settings.json" ]; then
    echo "ERROR: config/settings.json not found"
    exit 1
fi
echo "  ✓ config/settings.json"

if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "  ⚠ WARNING: .env file not found"
    echo "    Please create .env with your API keys before running"
else
    echo "  ✓ .env"
fi

echo ""

# Install npm dependencies
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "Installing npm dependencies..."
    cd "$PROJECT_DIR"
    npm install
    echo "  ✓ Dependencies installed"
else
    echo "  ✓ Dependencies already installed"
fi

echo ""

# Create logs directory
if [ ! -d "$PROJECT_DIR/logs" ]; then
    mkdir -p "$PROJECT_DIR/logs"
    echo "  ✓ Created logs directory"
else
    echo "  ✓ Logs directory exists"
fi

echo ""

# Set up cron job
echo "Setting up cron job..."

# Find node path
NODE_PATH=$(which node)

# Create cron entry
CRON_ENTRY="* * * * * cd $PROJECT_DIR && $NODE_PATH src/index.js >> logs/cron.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -F "active-registration" > /dev/null 2>&1 || \
   crontab -l 2>/dev/null | grep -F "$PROJECT_DIR" > /dev/null 2>&1; then
    echo "  ✓ Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null || true; echo "$CRON_ENTRY") | crontab -
    echo "  ✓ Cron job added"
fi

# Show cron entry
echo ""
echo "Cron entry:"
echo "  $CRON_ENTRY"

echo ""

# Check cron service (Linux only)
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet cron; then
        echo "  ✓ Cron service is running"
    else
        echo "  ⚠ WARNING: Cron service may not be running"
        echo "    Try: sudo systemctl start cron"
    fi
fi

echo ""
echo "=================================="
echo "✓ Installation complete!"
echo "=================================="
echo ""
echo "The registration reminder will now run every minute."
echo ""
echo "Next steps:"
echo "  1. Ensure your .env file has valid API keys"
echo "  2. Test with: npm run test:notification"
echo "  3. View logs with: tail -f logs/activity.log"
echo ""
