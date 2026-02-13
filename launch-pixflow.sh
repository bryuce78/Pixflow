#!/bin/bash

# Pixflow Web Launcher
# This script launches Pixflow web development mode (API + UI)

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Launch the app
echo "Starting Pixflow web dev..."
npm run dev
