#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
# This ensures the build fails if any single step fails (e.g., pip install failure).
set -o errexit

# 1. Install all project dependencies using the requirements.txt file
echo "Installing Python dependencies..."
pip install -r requirements.txt

# 2. Collect static files (CSS, JS, images) into a single folder (usually 'staticfiles')
# The --no-input flag prevents interactive prompts during the build process
echo "Collecting static files..."
python manage.py collectstatic --no-input

# 3. Apply any outstanding database migrations
echo "Running database migrations..."
python manage.py migrate

echo "Build script complete."