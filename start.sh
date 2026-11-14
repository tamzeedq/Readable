#!/bin/bash

# Readable App Quick Start
# Builds and runs the app in development mode

echo "🚀 Readable - Speed Reading App"
echo "================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

echo "✓ Node.js $(node --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "🔨 Starting development server..."
echo "   The app will open in a window shortly..."
echo ""
echo "📖 Keyboard Shortcuts:"
echo "   Space      - Play/Pause/Resume"
echo "   ←/→        - Seek word back/forward"
echo "   +/-        - Adjust speed"
echo "   Ctrl+S     - Settings"
echo ""

npm run tauri dev
