#!/usr/bin/env python
"""
Initialize test database for merchant panel demo testing.
This script creates the test database structure using Django migrations.
"""
import os
import sys
import django
from pathlib import Path

# Add the Backend directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module to test_settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.test_settings')

# Setup Django
django.setup()

from django.core.management import call_command
from django.conf import settings
from pathlib import Path

def main():
    """Initialize the test database."""
    print("=" * 60)
    print("INITIALIZING TEST DATABASE")
    print("=" * 60)
    
    # Get database path
    db_path = settings.DATABASES['default']['NAME']
    media_root = settings.MEDIA_ROOT
    
    print(f"Database: {db_path}")
    print(f"Media Root: {media_root}")
    print()
    
    # Create media directory if it doesn't exist
    if not media_root.exists():
        media_root.mkdir(parents=True, exist_ok=True)
        print(f"✓ Created media directory: {media_root}")
    else:
        print(f"✓ Media directory already exists: {media_root}")
    
    # Check if database already exists
    if Path(db_path).exists():
        print(f"⚠ Warning: Test database already exists at {db_path}")
        response = input("Do you want to delete it and recreate? (yes/no): ")
        if response.lower() in ['yes', 'y']:
            Path(db_path).unlink()
            print(f"✓ Deleted existing test database")
        else:
            print("Keeping existing database. Running migrations only...")
    
    # Run migrations
    print("\nRunning migrations...")
    try:
        call_command('migrate', verbosity=1, interactive=False)
        print("✓ Migrations completed successfully")
    except Exception as e:
        print(f"✗ Error running migrations: {e}")
        sys.exit(1)
    
    # Create default tags if they don't exist
    print("\nCreating default tags...")
    try:
        call_command('create_default_tags', verbosity=0)
        print("✓ Default tags created")
    except Exception as e:
        print(f"⚠ Warning: Could not create default tags: {e}")
    
    print("\n" + "=" * 60)
    print("TEST DATABASE INITIALIZATION COMPLETE")
    print("=" * 60)
    print(f"\nNext steps:")
    print(f"1. Run: python scripts/generate_test_data.py")
    print(f"   (or: python manage.py generate_test_data --settings=Backend.test_settings)")
    print(f"2. Start test server: ./run_test_server.sh")
    print("=" * 60)

if __name__ == '__main__':
    main()

