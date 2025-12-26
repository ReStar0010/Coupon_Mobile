#!/usr/bin/env python
"""
Generate test data for merchant panel demo.
This script creates comprehensive test data including:
- Merchant account and store
- Coupon templates
- Generated coupons
- Redemption records
- Log entries (views, redemptions, etc.)
- Share requests
All designed to showcase statistics and analytics features.
"""
import os
import sys
import django
from pathlib import Path
from datetime import timedelta, datetime
import random

# Add the Backend directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module to test_settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.test_settings')

# Setup Django
django.setup()

from django.contrib.auth.models import User, Group
from django.utils import timezone
from api.models import (
    Store, Coupon, CouponTemplate, Tag, StudentProfile, 
    MerchantProfile, CouponRedemption, Log, CouponShareRequest
)

def create_tags():
    """Create default tags if they don't exist."""
    tags_data = [
        {'name': 'food', 'display_name': '食物'},
        {'name': 'drink', 'display_name': '飲品'},
        {'name': 'entertainment', 'display_name': '娛樂'},
        {'name': 'shopping', 'display_name': '購物'},
        {'name': 'coffee', 'display_name': '咖啡'},
        {'name': 'restaurant', 'display_name': '餐廳'},
        {'name': 'discount', 'display_name': '折扣'},
    ]
    
    tags = {}
    for tag_data in tags_data:
        tag, created = Tag.objects.get_or_create(
            name=tag_data['name'],
            defaults={'display_name': tag_data['display_name']}
        )
        tags[tag_data['name']] = tag
    return tags

def create_merchant():
    """Create a test merchant account."""
    merchant_group, _ = Group.objects.get_or_create(name='Merchants')
    
    merchant_user, created = User.objects.get_or_create(
        username='demo_merchant',
        defaults={
            'email': 'merchant@demo.com',
            'first_name': 'Demo',
            'last_name': 'Merchant'
        }
    )
    merchant_user.set_password('demo123456')
    merchant_user.groups.add(merchant_group)
    merchant_user.save()
    
    merchant_profile, _ = MerchantProfile.objects.get_or_create(
        user=merchant_user,
        defaults={
            'phone': '0912345678',
            'contact_person': 'Demo商家',
            'contact_info': 'Line ID: demo_merchant'
        }
    )
    
    return merchant_user, merchant_profile

def create_store(merchant_user):
    """Create a test store."""
    store, created = Store.objects.get_or_create(
        owner=merchant_user,
        defaults={
            'name': 'Demo咖啡店',
            'lat': 25.0330,
            'lng': 121.5654,
            'address': '台北市信義區信義路五段7號',
            'business_hours': '週一至週日 07:00-22:00',
            'store_type': 'restaurant',
            'average_order_value': 250.00,  # For GMV calculation
        }
    )
    return store

def create_students(count=10):
    """Create test student accounts."""
    students = []
    for i in range(count):
        student_user, created = User.objects.get_or_create(
            username=f'demo_student_{i+1}',
            defaults={
                'email': f'student{i+1}@demo.com',
                'first_name': f'Demo',
                'last_name': f'Student{i+1}'
            }
        )
        if created:
            student_user.set_password('demo123456')
            student_user.save()
        
        student_profile, _ = StudentProfile.objects.get_or_create(
            user=student_user,
            defaults={
                'phone_number': f'0912345{i+1:03d}',
                'verified': True
            }
        )
        students.append((student_user, student_profile))
    return students

def create_coupon_templates(store, tags):
    """Create coupon templates for demo."""
    now = timezone.now()
    
    templates_data = [
        {
            'coupon_name': '咖啡買一送一',
            'coupon_detail': '任何咖啡飲品買一送一，限同品項',
            'important_notes': '不適用於特殊節日，需現場購買',
            'estimated_savings': 150.00,
            'total_quantity': 50,
            'draw_probability': 0.3,
            'template_redeem_code': 'COFF01',
            'tag_names': ['drink', 'coffee', 'discount'],
            'start_date': now - timedelta(days=30),
            'expiry_date': now + timedelta(days=30),
        },
        {
            'coupon_name': '早餐套餐優惠',
            'coupon_detail': '購買早餐套餐享9折優惠',
            'important_notes': '限早餐時段使用',
            'estimated_savings': 50.00,
            'total_quantity': 30,
            'draw_probability': 0.5,
            'template_redeem_code': 'BREAK01',
            'tag_names': ['food', 'coffee', 'discount'],
            'start_date': now - timedelta(days=20),
            'expiry_date': now + timedelta(days=40),
        },
        {
            'coupon_name': '蛋糕85折',
            'coupon_detail': '購買任何蛋糕享85折優惠',
            'important_notes': '限現場購買',
            'estimated_savings': 40.00,
            'total_quantity': 0,  # Store type coupon (EasyUse)
            'draw_probability': 0.0,
            'template_redeem_code': None,
            'tag_names': ['food', 'discount'],
            'start_date': now - timedelta(days=15),
            'expiry_date': now + timedelta(days=45),
        },
    ]
    
    templates = []
    for template_data in templates_data:
        template, created = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=template_data['coupon_name'],
            defaults={
                'coupon_detail': template_data['coupon_detail'],
                'important_notes': template_data['important_notes'],
                'start_date': template_data['start_date'],
                'expiry_date': template_data['expiry_date'],
                'total_quantity': template_data['total_quantity'],
                'remaining_quantity': template_data['total_quantity'],
                'draw_probability': template_data['draw_probability'],
                'template_redeem_code': template_data['template_redeem_code'],
                'estimated_savings': template_data['estimated_savings'],
                'is_active': True
            }
        )
        
        # Add tags
        for tag_name in template_data['tag_names']:
            if tag_name in tags:
                template.tags.add(tags[tag_name])
        
        templates.append(template)
    
    return templates

def generate_coupons_and_redemptions(templates, students, store):
    """Generate coupons and redemption records for statistics."""
    now = timezone.now()
    coupons_created = []
    redemptions_created = 0
    
    # Generate coupons from exclusive templates (total_quantity > 0)
    exclusive_templates = [t for t in templates if t.total_quantity > 0]
    
    for template in exclusive_templates:
        # Generate coupons for some students
        num_coupons = min(template.total_quantity, len(students))
        selected_students = random.sample(students, num_coupons)
        
        for student_user, student_profile in selected_students:
            # Generate coupon from template
            coupon = template.generate_coupon(recipient=student_user)
            if coupon:
                coupons_created.append((coupon, student_user, template))
    
    # Create redemptions (some by original owner, some by others after sharing)
    for coupon, original_owner, template in coupons_created:
        # 30% chance of redemption
        if random.random() < 0.3:
            # 60% chance redeemed by original owner, 40% by someone else (after sharing)
            if random.random() < 0.6:
                # Redeemed by original owner
                redeemer = original_owner
            else:
                # Redeemed by someone else (simulating sharing)
                other_students = [s for s in students if s[0] != original_owner]
                if other_students:
                    redeemer = random.choice(other_students)[0]
                else:
                    redeemer = original_owner
            
            # Create redemption with random date in the past 30 days
            redemption_date = now - timedelta(days=random.randint(0, 30))
            
            # Random location near store (within 500m)
            store_lat = store.lat
            store_lng = store.lng
            # Add small random offset (approximately 0.0045 degrees = 500m)
            offset = 0.0045
            redemption_lat = store_lat + random.uniform(-offset, offset)
            redemption_lng = store_lng + random.uniform(-offset, offset)
            
            redemption = CouponRedemption.objects.create(
                coupon=coupon,
                user=redeemer,
                redeemed_at=redemption_date,
                savings_amount=template.estimated_savings,
                lat=redemption_lat,
                lng=redemption_lng,
            )
            redemptions_created += 1
    
    return coupons_created, redemptions_created

def create_share_requests(coupons_created, students):
    """Create share requests to simulate coupon sharing."""
    share_requests_created = 0
    
    for coupon, original_owner, template in coupons_created:
        # 20% chance of being shared
        if random.random() < 0.2:
            # Find a different student to share with
            other_students = [s for s in students if s[0] != original_owner]
            if other_students:
                to_user = random.choice(other_students)[0]
                
                # Create share request (most are accepted)
                status = 'accepted' if random.random() < 0.8 else 'pending'
                
                share_request = CouponShareRequest.objects.create(
                    coupon=coupon,
                    from_user=original_owner,
                    to_user=to_user,
                    token=f'share_{coupon.id}_{random.randint(1000, 9999)}',
                    status=status,
                    created_at=timezone.now() - timedelta(days=random.randint(1, 20)),
                )
                
                if status == 'accepted':
                    share_requests_created += 1
                    # Update coupon holder if accepted
                    coupon.last_holder = coupon.current_holder
                    coupon.current_holder = to_user
                    coupon.save()
    
    return share_requests_created

def create_logs(store, templates, coupons_created, students):
    """Create log entries for views and other actions."""
    now = timezone.now()
    logs_created = 0
    
    # Create template view logs (for analytics)
    for template in templates:
        # Generate views over the past 30 days
        num_views = random.randint(50, 200)
        for _ in range(num_views):
            # Random date in past 30 days
            view_date = now - timedelta(days=random.randint(0, 30))
            
            # Random student (or None for anonymous)
            if random.random() < 0.7:  # 70% logged in users
                user = random.choice(students)[0]
            else:
                user = None
            
            # Random location (near store or random)
            if random.random() < 0.6:  # 60% near store
                store_lat = store.lat
                store_lng = store.lng
                offset = 0.0045  # ~500m
                lat = store_lat + random.uniform(-offset, offset)
                lng = store_lng + random.uniform(-offset, offset)
            else:
                lat = None
                lng = None
            
            log = Log.objects.create(
                action='template_view',
                user=user,
                template=template,
                timestamp=view_date,
                lat=lat,
                lng=lng,
            )
            logs_created += 1
    
    # Create coupon view logs
    for coupon, owner, template in coupons_created[:20]:  # Limit to first 20
        num_views = random.randint(5, 15)
        for _ in range(num_views):
            view_date = now - timedelta(days=random.randint(0, 30))
            user = random.choice(students)[0] if random.random() < 0.8 else None
            
            log = Log.objects.create(
                action='view',
                user=user,
                coupon=coupon,
                timestamp=view_date,
            )
            logs_created += 1
    
    return logs_created

def main():
    """Main function to generate all test data."""
    print("=" * 60)
    print("GENERATING TEST DATA FOR MERCHANT PANEL DEMO")
    print("=" * 60)
    print()
    
    # Create tags
    print("Creating tags...")
    tags = create_tags()
    print(f"✓ Created/verified {len(tags)} tags")
    
    # Create merchant
    print("\nCreating merchant account...")
    merchant_user, merchant_profile = create_merchant()
    print(f"✓ Merchant: {merchant_user.email} (password: demo123456)")
    
    # Create store
    print("\nCreating store...")
    store = create_store(merchant_user)
    print(f"✓ Store: {store.name}")
    
    # Create students
    print("\nCreating student accounts...")
    students = create_students(count=10)
    print(f"✓ Created {len(students)} student accounts")
    print(f"  Example: {students[0][0].email} (password: demo123456)")
    
    # Create coupon templates
    print("\nCreating coupon templates...")
    templates = create_coupon_templates(store, tags)
    print(f"✓ Created {len(templates)} coupon templates")
    
    # Generate coupons and redemptions
    print("\nGenerating coupons and redemptions...")
    coupons_created, redemptions_created = generate_coupons_and_redemptions(
        templates, students, store
    )
    print(f"✓ Generated {len(coupons_created)} coupons")
    print(f"✓ Created {redemptions_created} redemption records")
    
    # Create share requests
    print("\nCreating share requests...")
    shares_created = create_share_requests(coupons_created, students)
    print(f"✓ Created {shares_created} accepted share requests")
    
    # Create logs
    print("\nCreating log entries...")
    logs_created = create_logs(store, templates, coupons_created, students)
    print(f"✓ Created {logs_created} log entries")
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST DATA GENERATION COMPLETE")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  - Merchant: {merchant_user.email}")
    print(f"  - Store: {store.name}")
    print(f"  - Students: {len(students)}")
    print(f"  - Templates: {len(templates)}")
    print(f"  - Coupons: {len(coupons_created)}")
    print(f"  - Redemptions: {redemptions_created}")
    print(f"  - Share Requests: {shares_created}")
    print(f"  - Log Entries: {logs_created}")
    print(f"\nLogin credentials:")
    print(f"  Merchant: merchant@demo.com / demo123456")
    print(f"  Student: student1@demo.com / demo123456")
    print("=" * 60)

if __name__ == '__main__':
    main()

