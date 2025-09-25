import os
import django
import getpass

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.settings')
django.setup()

from api.models import User
from django.contrib.auth.hashers import make_password

# Get the email address
email = input('Enter the email address of the admin account: ')

try:
    user = User.objects.get(email=email)
    print(f"Found user: {user.email}")
    
    # Get and confirm new password
    while True:
        password = getpass.getpass('Enter new password: ')
        confirm_password = getpass.getpass('Confirm new password: ')
        
        if password == confirm_password:
            break
        else:
            print("Passwords don't match. Try again.")
    
    # Update the password
    user.password = make_password(password)
    user.save()
    print(f"Password for {user.email} has been updated successfully!")
    
except User.DoesNotExist:
    print(f"No user found with email: {email}")
    available_users = User.objects.all()
    if available_users.exists():
        print("\nAvailable users:")
        for user in available_users:
            print(f"- {user.email} {'(admin)' if user.is_superuser else ''}")
