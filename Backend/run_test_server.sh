#!/bin/bash

# Test server startup script for merchant panel demo
# This script starts the Django development server with test settings

echo "============================================================"
echo "Starting Test Server for Merchant Panel Demo"
echo "============================================================"
echo ""
echo "Configuration:"
echo "  - Settings: Backend.test_settings"
echo "  - Database: db_test.sqlite3"
echo "  - Media: images_test/"
echo "  - Port: 8001"
echo ""
echo "============================================================"
echo ""

# Set Django settings module to test_settings
export DJANGO_SETTINGS_MODULE=Backend.test_settings

# Change to the Backend directory
cd "$(dirname "$0")"

# Start the Django development server on port 8001
python manage.py runserver 8001

