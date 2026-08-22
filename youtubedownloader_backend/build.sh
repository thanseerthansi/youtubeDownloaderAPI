#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
set -o errexit

# Ensure Node.js is available for yt-dlp JavaScript challenge solver
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing standalone Node.js for yt-dlp..."
    mkdir -p "$HOME/node_bin"
    curl -fsSL https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.xz | tar -xJ -C "$HOME/node_bin" --strip-components=1
    export PATH="$HOME/node_bin/bin:$PATH"
fi

# 1. Install all project dependencies using the requirements.txt file
echo "Installing Python dependencies..."
pip install -r requirements.txt

# 2. Collect static files
echo "Collecting static files..."
python manage.py collectstatic --no-input

# 3. Apply any outstanding database migrations
echo "Running database migrations..."
python manage.py migrate

echo "Build script complete."