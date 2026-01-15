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

Usage:
    python generate_test_data.py [--scenario SCENARIO_NAME] [--predictable]
    
    --scenario: Use a predefined scenario (high_redemption, high_sharing, high_stranger, time_distribution)
    --predictable: Generate predictable data with fixed values for manual verification
    --list: List all available scenarios
"""
import os
import sys
import django
import argparse
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

# Import test scenarios
try:
    from scripts.test_scenarios import get_scenario, list_scenarios, SCENARIO_PREDICTABLE
except ImportError:
    # Fallback if test_scenarios is not available
    SCENARIO_PREDICTABLE = None
    def get_scenario(name):
        return None
    def list_scenarios():
        return []

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
    merchant_group, _ = Group.objects.get_or_create(name='Merchant')
    
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

def create_store(merchant_user, average_order_value=250.00):
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
            'average_order_value': average_order_value,
        }
    )
    # Update average_order_value if store already exists
    if not created:
        store.average_order_value = average_order_value
        store.save()
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

def create_coupon_templates(store, tags, scenario_config=None):
    """Create coupon templates based on scenario configuration or default."""
    now = timezone.now()
    templates = []
    
    if scenario_config:
        # Generate templates based on scenario
        template_names = [
            '咖啡買一送一', '早餐套餐優惠', '蛋糕85折', 
            '下午茶優惠', '晚餐套餐', '甜點折扣'
        ]
        
        # Active exclusive templates
        for i in range(scenario_config.num_active_templates):
            template, _ = CouponTemplate.objects.get_or_create(
                store=store,
                coupon_name=template_names[i % len(template_names)],
                defaults={
                    'coupon_detail': f'優惠詳情 {i+1}',
                    'important_notes': '注意事項',
                    'start_date': now - timedelta(days=30),
                    'expiry_date': now + timedelta(days=30),
                    'total_quantity': scenario_config.num_coupons_per_template,
                    'remaining_quantity': scenario_config.num_coupons_per_template,
                    'draw_probability': 0.3,
                    'template_redeem_code': f'TEMP{i+1:02d}',
                    'estimated_savings': 150.00,
                    'is_active': True
                }
            )
            if 'coffee' in tags:
                template.tags.add(tags['coffee'])
            templates.append(template)
        
        # Inactive templates
        for i in range(scenario_config.num_inactive_templates):
            idx = scenario_config.num_active_templates + i
            template, _ = CouponTemplate.objects.get_or_create(
                store=store,
                coupon_name=template_names[idx % len(template_names)],
                defaults={
                    'coupon_detail': f'優惠詳情 {idx+1}',
                    'important_notes': '注意事項',
                    'start_date': now - timedelta(days=60),
                    'expiry_date': now - timedelta(days=1),  # Expired
                    'total_quantity': 20,
                    'remaining_quantity': 20,
                    'draw_probability': 0.3,
                    'template_redeem_code': f'TEMP{idx+1:02d}',
                    'estimated_savings': 100.00,
                    'is_active': False
                }
            )
            templates.append(template)
        
        # Store templates (EasyUse - total_quantity=0)
        for i in range(scenario_config.num_store_templates):
            idx = scenario_config.num_active_templates + scenario_config.num_inactive_templates + i
            template, _ = CouponTemplate.objects.get_or_create(
                store=store,
                coupon_name=template_names[idx % len(template_names)],
                defaults={
                    'coupon_detail': f'隨取及用優惠 {i+1}',
                    'important_notes': '限現場使用',
                    'start_date': now - timedelta(days=30),
                    'expiry_date': now + timedelta(days=30),
                    'total_quantity': 0,  # Store type
                    'remaining_quantity': 0,
                    'draw_probability': 0.0,
                    'template_redeem_code': None,
                    'estimated_savings': 80.00,
                    'is_active': True
                }
            )
            templates.append(template)
    else:
        # Default templates (backward compatibility)
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
            for tag_name in template_data.get('tag_names', []):
                if tag_name in tags:
                    template.tags.add(tags[tag_name])
            
            templates.append(template)
    
    return templates

def generate_coupons_and_redemptions(templates, students, store, scenario_config=None, use_predictable=False):
    """Generate coupons and redemption records for statistics."""
    now = timezone.now()
    coupons_created = []
    redemptions_created = 0
    
    # Generate coupons from exclusive templates (total_quantity > 0)
    exclusive_templates = [t for t in templates if t.total_quantity > 0]
    
    # Determine how many coupons to generate
    if scenario_config:
        coupons_per_template = scenario_config.num_coupons_per_template
    else:
        coupons_per_template = None  # Use template's total_quantity
    
    for template in exclusive_templates:
        if scenario_config:
            num_coupons = min(coupons_per_template, template.total_quantity, len(students))
        else:
            num_coupons = min(template.total_quantity, len(students))
        
        selected_students = random.sample(students, num_coupons) if len(students) >= num_coupons else students
        
        for student_user, student_profile in selected_students:
            # Generate coupon from template
            coupon = template.generate_coupon(recipient=student_user)
            if coupon:
                coupons_created.append((coupon, student_user, template))
    
    # Determine redemption parameters
    if scenario_config:
        redemption_rate = scenario_config.redemption_rate
        stranger_ratio = scenario_config.stranger_redemption_ratio
    else:
        redemption_rate = 0.3
        stranger_ratio = 0.4
    
    # Create redemptions
    num_redemptions = int(len(coupons_created) * redemption_rate)
    if use_predictable and scenario_config:
        # For predictable scenario, use exact numbers
        num_redemptions = scenario_config.expected_results.get('total_redemptions', num_redemptions)
    
    # Select which coupons to redeem
    if use_predictable:
        coupons_to_redeem = coupons_created[:min(num_redemptions, len(coupons_created))]
    else:
        coupons_to_redeem = random.sample(coupons_created, min(num_redemptions, len(coupons_created)))
    
    for idx, (coupon, original_owner, template) in enumerate(coupons_to_redeem):
        # Determine redeemer based on stranger ratio
        if use_predictable:
            # For predictable: first N are by original owner, rest by strangers
            num_original = int(num_redemptions * (1 - stranger_ratio))
            is_stranger = idx >= num_original
        else:
            is_stranger = random.random() < stranger_ratio
        
        if is_stranger:
            # Redeemed by someone else (simulating sharing)
            other_students = [s for s in students if s[0] != original_owner]
            if other_students:
                redeemer = random.choice(other_students)[0] if not use_predictable else other_students[0][0]
            else:
                redeemer = original_owner
        else:
            redeemer = original_owner
        
        # Create redemption with date distribution
        if scenario_config and scenario_config.name == 'time_distribution':
            # Distribute across 30 days
            days_ago = random.randint(0, 29) if not use_predictable else (idx % 30)
        else:
            days_ago = random.randint(0, 30) if not use_predictable else (idx % 30)
        
        redemption_date = now - timedelta(days=days_ago)
        
        # Location: some near store, some far
        store_lat = store.lat
        store_lng = store.lng
        offset = 0.0045  # ~500m
        if use_predictable:
            # Alternate between near and far
            is_nearby = (idx % 2) == 0
        else:
            is_nearby = random.random() < 0.7  # 70% nearby
        
        if is_nearby:
            redemption_lat = store_lat + random.uniform(-offset, offset) if not use_predictable else store_lat + 0.002
            redemption_lng = store_lng + random.uniform(-offset, offset) if not use_predictable else store_lng + 0.002
        else:
            # Far away (more than 500m)
            redemption_lat = store_lat + random.uniform(0.01, 0.02) if not use_predictable else store_lat + 0.01
            redemption_lng = store_lng + random.uniform(0.01, 0.02) if not use_predictable else store_lng + 0.01
        
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

def create_share_requests(coupons_created, students, scenario_config=None, use_predictable=False):
    """Create share requests to simulate coupon sharing."""
    share_requests_created = 0
    
    if scenario_config:
        sharing_rate = scenario_config.sharing_rate
        avg_transfers = scenario_config.avg_transfers_per_shared_coupon
    else:
        sharing_rate = 0.2
        avg_transfers = 1.0
    
    # Determine which coupons to share
    if use_predictable and scenario_config:
        num_to_share = int(scenario_config.num_exclusive_coupons * sharing_rate)
    else:
        num_to_share = int(len(coupons_created) * sharing_rate)
    
    if use_predictable:
        coupons_to_share = coupons_created[:min(num_to_share, len(coupons_created))]
    else:
        coupons_to_share = random.sample(coupons_created, min(num_to_share, len(coupons_created)))
    
    for coupon, original_owner, template in coupons_to_share:
        # Determine number of transfers for this coupon
        if use_predictable:
            num_transfers = int(avg_transfers)
        else:
            # Use Poisson-like distribution around avg_transfers
            num_transfers = max(1, int(random.gauss(avg_transfers, 0.5)))
        
        current_holder = original_owner
        for transfer_num in range(num_transfers):
            other_students = [s for s in students if s[0] != current_holder]
            if not other_students:
                break
            
            if use_predictable:
                to_user = other_students[transfer_num % len(other_students)][0]
            else:
                to_user = random.choice(other_students)[0]
            
            # Create share request (most are accepted)
            status = 'accepted' if not use_predictable and random.random() < 0.8 else 'accepted'
            
            share_request = CouponShareRequest.objects.create(
                coupon=coupon,
                from_user=current_holder,
                to_user=to_user,
                token=f'share_{coupon.id}_{transfer_num}_{random.randint(1000, 9999) if not use_predictable else 1000}',
                status=status,
                created_at=timezone.now() - timedelta(days=random.randint(1, 20) if not use_predictable else 10),
            )
            
            if status == 'accepted':
                share_requests_created += 1
                # Update coupon holder if accepted
                coupon.last_holder = coupon.current_holder
                coupon.current_holder = to_user
                coupon.save()
                current_holder = to_user
    
    return share_requests_created

def create_logs(store, templates, coupons_created, students, scenario_config=None, use_predictable=False):
    """Create log entries for views and other actions."""
    now = timezone.now()
    logs_created = 0
    
    # Create template view logs (for analytics)
    for template in templates:
        if scenario_config:
            clicks_per_template = scenario_config.clicks_per_template
            nearby_ratio = scenario_config.nearby_click_ratio
        else:
            clicks_per_template = random.randint(50, 200)
            nearby_ratio = 0.6
        
        # Only create logs for active templates (or all if no scenario)
        if template.is_active or not scenario_config:
            for i in range(clicks_per_template):
                # Date distribution
                if scenario_config and scenario_config.name == 'time_distribution':
                    days_ago = random.randint(0, 29) if not use_predictable else (i % 30)
                else:
                    days_ago = random.randint(0, 30) if not use_predictable else (i % 30)
                
                view_date = now - timedelta(days=days_ago)
                
                # Random student (or None for anonymous)
                if use_predictable:
                    user = students[i % len(students)][0] if i % 3 != 0 else None
                else:
                    user = random.choice(students)[0] if random.random() < 0.7 else None
                
                # Location: near store or far
                is_nearby = random.random() < nearby_ratio if not use_predictable else (i % 2 == 0)
                if is_nearby:
                    store_lat = store.lat
                    store_lng = store.lng
                    offset = 0.0045  # ~500m
                    lat = store_lat + random.uniform(-offset, offset) if not use_predictable else store_lat + 0.002
                    lng = store_lng + random.uniform(-offset, offset) if not use_predictable else store_lng + 0.002
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
    
    # Create coupon view logs (optional, not used in analytics but good for completeness)
    if not scenario_config or scenario_config.name != 'predictable':
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
    parser = argparse.ArgumentParser(description='Generate test data for merchant panel testing')
    parser.add_argument('--scenario', type=str, help='Use a predefined scenario', choices=list_scenarios())
    parser.add_argument('--predictable', action='store_true', help='Generate predictable data with fixed values')
    parser.add_argument('--list', action='store_true', help='List all available scenarios')
    
    args = parser.parse_args()
    
    if args.list:
        print("Available scenarios:")
        for name in list_scenarios():
            scenario = get_scenario(name)
            if scenario:
                print(f"  - {name}: {scenario.description}")
        return
    
    # Determine scenario configuration
    scenario_config = None
    use_predictable = args.predictable
    
    if args.scenario:
        scenario_config = get_scenario(args.scenario)
        if not scenario_config:
            print(f"Error: Scenario '{args.scenario}' not found")
            return
        if use_predictable:
            scenario_config = SCENARIO_PREDICTABLE if SCENARIO_PREDICTABLE else scenario_config
    elif use_predictable:
        scenario_config = SCENARIO_PREDICTABLE if SCENARIO_PREDICTABLE else None
    
    print("=" * 60)
    if scenario_config:
        print(f"GENERATING TEST DATA: {scenario_config.name.upper()}")
        print(f"Description: {scenario_config.description}")
    else:
        print("GENERATING TEST DATA FOR MERCHANT PANEL DEMO (Default)")
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
    avg_order_value = scenario_config.average_order_value if scenario_config else 250.00
    store = create_store(merchant_user, avg_order_value)
    print(f"✓ Store: {store.name} (Average Order Value: {store.average_order_value})")
    
    # Create students (need enough for the scenario)
    num_students = 20 if scenario_config else 10
    if scenario_config:
        num_students = max(num_students, scenario_config.num_exclusive_coupons // 2)
    print("\nCreating student accounts...")
    students = create_students(count=num_students)
    print(f"✓ Created {len(students)} student accounts")
    print(f"  Example: {students[0][0].email} (password: demo123456)")
    
    # Create coupon templates
    print("\nCreating coupon templates...")
    templates = create_coupon_templates(store, tags, scenario_config)
    print(f"✓ Created {len(templates)} coupon templates")
    active_count = sum(1 for t in templates if t.is_active)
    print(f"  - Active: {active_count}, Inactive: {len(templates) - active_count}")
    
    # Generate coupons and redemptions
    print("\nGenerating coupons and redemptions...")
    coupons_created, redemptions_created = generate_coupons_and_redemptions(
        templates, students, store, scenario_config, use_predictable
    )
    print(f"✓ Generated {len(coupons_created)} coupons")
    print(f"✓ Created {redemptions_created} redemption records")
    if scenario_config:
        expected_redemptions = int(scenario_config.num_exclusive_coupons * scenario_config.redemption_rate)
        print(f"  Expected: ~{expected_redemptions} redemptions")
    
    # Create share requests
    print("\nCreating share requests...")
    shares_created = create_share_requests(coupons_created, students, scenario_config, use_predictable)
    print(f"✓ Created {shares_created} accepted share requests")
    
    # Create logs
    print("\nCreating log entries...")
    logs_created = create_logs(store, templates, coupons_created, students, scenario_config, use_predictable)
    print(f"✓ Created {logs_created} log entries")
    if scenario_config:
        expected_views = sum(scenario_config.clicks_per_template for _ in range(scenario_config.num_active_templates + scenario_config.num_store_templates))
        print(f"  Expected: ~{expected_views} template views")
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST DATA GENERATION COMPLETE")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  - Merchant: {merchant_user.email}")
    print(f"  - Store: {store.name}")
    print(f"  - Students: {len(students)}")
    print(f"  - Templates: {len(templates)} (Active: {active_count})")
    print(f"  - Coupons: {len(coupons_created)}")
    print(f"  - Redemptions: {redemptions_created}")
    print(f"  - Share Requests: {shares_created}")
    print(f"  - Log Entries: {logs_created}")
    if scenario_config:
        print(f"\nScenario: {scenario_config.name}")
        print(f"  - Redemption Rate: {scenario_config.redemption_rate * 100:.1f}%")
        print(f"  - Stranger Ratio: {scenario_config.stranger_redemption_ratio * 100:.1f}%")
        print(f"  - Sharing Rate: {scenario_config.sharing_rate * 100:.1f}%")
    print(f"\nLogin credentials:")
    print(f"  Merchant: merchant@demo.com / demo123456")
    print(f"  Student: student1@demo.com / demo123456")
    print("=" * 60)

if __name__ == '__main__':
    main()

