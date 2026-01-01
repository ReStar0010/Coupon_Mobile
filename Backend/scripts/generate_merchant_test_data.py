#!/usr/bin/env python
"""
Generate test data for merchant statistics testing.
Supports generating data for all 5 testing stages with customizable parameters.

Usage:
    python generate_merchant_test_data.py --stage STAGE [--custom-params ...]
    python generate_merchant_test_data.py --scenario SCENARIO_NAME
"""
import os
import sys
import django
import argparse
import json
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

from scripts.merchant_test_scenarios import (
    get_stage_config, create_custom_config, load_config_from_dict,
    Stage1Config, Stage2Config, Stage3Config, Stage4Config, Stage5Config
)

MERCHANT_EMAIL = "merchant@demo.com"
MERCHANT_PASSWORD = "demo123456"


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
    """Create or get merchant account."""
    merchant_group, _ = Group.objects.get_or_create(name='Merchants')
    
    merchant_user, created = User.objects.get_or_create(
        username='demo_merchant',
        defaults={
            'email': MERCHANT_EMAIL,
            'first_name': 'Demo',
            'last_name': 'Merchant'
        }
    )
    merchant_user.set_password(MERCHANT_PASSWORD)
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
    """Create or get store."""
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
    if not created:
        store.average_order_value = average_order_value
        store.save()
    return store


def create_students(count=20):
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


def generate_stage1_data(store, tags, students, config: Stage1Config):
    """Generate data for Stage 1: Basic Counting Metrics."""
    now = timezone.now()
    templates = []
    template_names = [
        '咖啡買一送一', '早餐套餐優惠', '蛋糕85折', 
        '下午茶優惠', '晚餐套餐', '甜點折扣'
    ]
    
    # Active exclusive templates
    for i in range(config.num_active_templates):
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=f"{template_names[i % len(template_names)]}_Active_{i+1}",
            defaults={
                'coupon_detail': f'優惠詳情 {i+1}',
                'important_notes': '注意事項',
                'start_date': now - timedelta(days=30),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': config.total_quantity_per_template,
                'remaining_quantity': config.total_quantity_per_template,
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
    for i in range(config.num_inactive_templates):
        idx = config.num_active_templates + i
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=f"{template_names[idx % len(template_names)]}_Inactive_{i+1}",
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
    
    # Store templates (EasyUse)
    for i in range(config.num_store_templates):
        idx = config.num_active_templates + config.num_inactive_templates + i
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=f"{template_names[idx % len(template_names)]}_Store_{i+1}",
            defaults={
                'coupon_detail': f'隨取及用優惠 {i+1}',
                'important_notes': '限現場使用',
                'start_date': now - timedelta(days=30),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': 0,
                'remaining_quantity': 0,
                'draw_probability': 0.0,
                'template_redeem_code': None,
                'estimated_savings': 80.00,
                'is_active': True
            }
        )
        templates.append(template)
    
    # Generate coupons from exclusive templates
    coupons_created = []
    exclusive_templates = [t for t in templates if t.total_quantity > 0]
    for template in exclusive_templates:
        num_coupons = min(template.total_quantity, len(students))
        selected_students = random.sample(students, num_coupons) if len(students) >= num_coupons else students
        
        for student_user, _ in selected_students:
            coupon = template.generate_coupon(recipient=student_user)
            if coupon:
                coupon.acquisition_method = 'consolidate'
                coupon.save()
                coupons_created.append(coupon)
    
    # Create template view logs
    logs_created = 0
    for template in templates:
        for i in range(config.clicks_per_template):
            days_ago = random.randint(0, 30)
            view_date = now - timedelta(days=days_ago)
            user = random.choice(students)[0] if random.random() < 0.7 else None
            
            log = Log.objects.create(
                action='template_view',
                user=user,
                template=template,
                timestamp=view_date,
            )
            logs_created += 1
    
    return {
        'templates': templates,
        'coupons': coupons_created,
        'logs': logs_created,
        'redemptions': 0
    }


def generate_stage2_data(store, tags, students, config: Stage2Config):
    """Generate data for Stage 2: EasyUse Template Analytics."""
    now = timezone.now()
    templates = []
    template_names = ['隨取及用優惠1', '隨取及用優惠2', '隨取及用優惠3']
    
    # Create EasyUse templates
    for i in range(config.num_store_templates):
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=f"{template_names[i % len(template_names)]}_Stage2_{i+1}",
            defaults={
                'coupon_detail': f'隨取及用優惠詳情 {i+1}',
                'important_notes': '限現場使用',
                'start_date': now - timedelta(days=config.time_range_days),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': 0,
                'remaining_quantity': 0,
                'draw_probability': 0.0,
                'template_redeem_code': None,
                'estimated_savings': 80.00,
                'is_active': True
            }
        )
        templates.append(template)
    
    # Create template view logs
    logs_created = 0
    store_lat = store.lat
    store_lng = store.lng
    offset = 0.0045  # ~500m
    
    for template in templates:
        for i in range(config.clicks_per_template):
            days_ago = random.randint(0, config.time_range_days - 1)
            view_date = now - timedelta(days=days_ago)
            user = random.choice(students)[0] if random.random() < 0.7 else None
            
            # Location based on nearby_click_ratio
            is_nearby = random.random() < config.nearby_click_ratio
            if is_nearby:
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
    
    # Create store coupons and redemptions
    coupons_created = []
    redemptions_created = 0
    
    for template in templates:
        num_redemptions = int(config.clicks_per_template * config.conversion_rate)
        
        for i in range(num_redemptions):
            # Create store coupon
            coupon = Coupon.objects.create(
                store=store,
                template=template,
                coupon_name=template.coupon_name,
                coupon_detail=template.coupon_detail,
                important_notes=template.important_notes,
                start_date=template.start_date,
                expiry_date=template.expiry_date,
                coupon_type='store',
                estimated_savings=template.estimated_savings,
            )
            coupons_created.append(coupon)
            
            # Create redemption
            days_ago = random.randint(0, config.time_range_days - 1)
            redemption_date = now - timedelta(days=days_ago)
            redeemer = random.choice(students)[0]
            
            is_nearby = random.random() < 0.7
            if is_nearby:
                redemption_lat = store_lat + random.uniform(-offset, offset)
                redemption_lng = store_lng + random.uniform(-offset, offset)
            else:
                redemption_lat = store_lat + random.uniform(0.01, 0.02)
                redemption_lng = store_lng + random.uniform(0.01, 0.02)
            
            CouponRedemption.objects.create(
                coupon=coupon,
                user=redeemer,
                redeemed_at=redemption_date,
                savings_amount=template.estimated_savings,
                lat=redemption_lat,
                lng=redemption_lng,
            )
            redemptions_created += 1
    
    return {
        'templates': templates,
        'coupons': coupons_created,
        'logs': logs_created,
        'redemptions': redemptions_created
    }


def generate_stage3_data(store, tags, students, config: Stage3Config):
    """Generate data for Stage 3: Exclusive Basic Metrics."""
    now = timezone.now()
    templates = []
    template_names = ['咖啡買一送一', '早餐套餐優惠', '蛋糕85折']
    
    # Create Exclusive templates
    for i in range(config.num_exclusive_templates):
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=f"{template_names[i % len(template_names)]}_Stage3_{i+1}",
            defaults={
                'coupon_detail': f'優惠詳情 {i+1}',
                'important_notes': '注意事項',
                'start_date': now - timedelta(days=config.time_range_days),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': config.coupons_per_template,
                'remaining_quantity': config.coupons_per_template,
                'draw_probability': 0.3,
                'template_redeem_code': f'TEMP{i+1:02d}',
                'estimated_savings': 150.00,
                'is_active': True
            }
        )
        if 'coffee' in tags:
            template.tags.add(tags['coffee'])
        templates.append(template)
    
    # Generate coupons
    coupons_created = []
    for template in templates:
        num_coupons = min(template.total_quantity, len(students))
        selected_students = random.sample(students, num_coupons) if len(students) >= num_coupons else students
        
        for student_user, _ in selected_students:
            coupon = template.generate_coupon(recipient=student_user)
            if coupon:
                coupon.acquisition_method = 'consolidate'
                coupon.save()
                coupons_created.append(coupon)
    
    # Create template view logs
    logs_created = 0
    store_lat = store.lat
    store_lng = store.lng
    offset = 0.0045
    
    for template in templates:
        for i in range(config.clicks_per_template):
            days_ago = random.randint(0, config.time_range_days - 1)
            view_date = now - timedelta(days=days_ago)
            user = random.choice(students)[0] if random.random() < 0.7 else None
            
            is_nearby = random.random() < config.nearby_click_ratio
            if is_nearby:
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
    
    # Create redemptions
    redemptions_created = 0
    num_redemptions = int(len(coupons_created) * config.redemption_rate)
    coupons_to_redeem = random.sample(coupons_created, min(num_redemptions, len(coupons_created)))
    
    for coupon in coupons_to_redeem:
        days_ago = random.randint(0, config.time_range_days - 1)
        redemption_date = now - timedelta(days=days_ago)
        
        is_nearby = random.random() < 0.7
        if is_nearby:
            redemption_lat = store_lat + random.uniform(-offset, offset)
            redemption_lng = store_lng + random.uniform(-offset, offset)
        else:
            redemption_lat = store_lat + random.uniform(0.01, 0.02)
            redemption_lng = store_lng + random.uniform(0.01, 0.02)
        
        CouponRedemption.objects.create(
            coupon=coupon,
            user=coupon.current_holder,
            redeemed_at=redemption_date,
            savings_amount=coupon.estimated_savings,
            lat=redemption_lat,
            lng=redemption_lng,
        )
        redemptions_created += 1
    
    return {
        'templates': templates,
        'coupons': coupons_created,
        'logs': logs_created,
        'redemptions': redemptions_created
    }


def generate_stage4_data(store, tags, students, config: Stage4Config):
    """Generate data for Stage 4: Exclusive Advanced Metrics."""
    now = timezone.now()
    templates = []
    template_names = ['咖啡買一送一', '早餐套餐優惠']
    
    # Create Exclusive templates
    for i in range(config.num_exclusive_templates):
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name=f"{template_names[i % len(template_names)]}_Stage4_{i+1}",
            defaults={
                'coupon_detail': f'優惠詳情 {i+1}',
                'important_notes': '注意事項',
                'start_date': now - timedelta(days=config.time_range_days),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': config.coupons_per_template,
                'remaining_quantity': config.coupons_per_template,
                'draw_probability': 0.3,
                'template_redeem_code': f'TEMP{i+1:02d}',
                'estimated_savings': 150.00,
                'is_active': True
            }
        )
        if 'coffee' in tags:
            template.tags.add(tags['coffee'])
        templates.append(template)
    
    # Generate coupons with different acquisition methods
    coupons_created = []
    for template in templates:
        num_coupons = min(template.total_quantity, len(students))
        selected_students = random.sample(students, num_coupons) if len(students) >= num_coupons else students
        
        # Calculate how many should be consolidate vs transfer/public_pool
        num_consolidate = int(num_coupons * (1 - config.stranger_acquisition_ratio))
        num_to_share = int(num_coupons * config.sharing_rate)
        
        for idx, (student_user, _) in enumerate(selected_students):
            coupon = template.generate_coupon(recipient=student_user)
            if coupon:
                if idx < num_consolidate:
                    coupon.acquisition_method = 'consolidate'
                elif idx < num_consolidate + num_to_share:
                    # Randomly assign transfer or public_pool
                    coupon.acquisition_method = random.choice(['transfer', 'public_pool'])
                else:
                    coupon.acquisition_method = 'consolidate'  # Default
                coupon.save()
                coupons_created.append(coupon)
    
    # Create share requests for transfer/public_pool coupons
    share_requests_created = 0
    transfer_coupons = [c for c in coupons_created if c.acquisition_method in ['transfer', 'public_pool']]
    
    for coupon in transfer_coupons[:num_to_share]:
        other_students = [s for s in students if s[0] != coupon.original_owner]
        if other_students:
            to_user = random.choice(other_students)[0]
            share_request = CouponShareRequest.objects.create(
                coupon=coupon,
                from_user=coupon.original_owner,
                to_user=to_user,
                token=f'share_{coupon.id}_{random.randint(1000, 9999)}',
                status='accepted',
                created_at=now - timedelta(days=random.randint(1, config.time_range_days - 1)),
            )
            coupon.last_holder = coupon.current_holder
            coupon.current_holder = to_user
            coupon.save()
            share_requests_created += 1
    
    # Create template view logs
    logs_created = 0
    store_lat = store.lat
    store_lng = store.lng
    offset = 0.0045
    
    for template in templates:
        for i in range(config.clicks_per_template):
            days_ago = random.randint(0, config.time_range_days - 1)
            view_date = now - timedelta(days=days_ago)
            user = random.choice(students)[0] if random.random() < 0.7 else None
            
            is_nearby = random.random() < config.nearby_click_ratio
            if is_nearby:
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
    
    # Create redemptions
    redemptions_created = 0
    total_redemptions = int(len(coupons_created) * config.redemption_rate)
    coupons_to_redeem = random.sample(coupons_created, min(total_redemptions, len(coupons_created)))
    
    # Calculate how many consolidate vs non-consolidate redemptions
    consolidate_coupons = [c for c in coupons_created if c.acquisition_method == 'consolidate']
    num_consolidate_redemptions = int(len(consolidate_coupons) * config.redemption_rate)
    consolidate_to_redeem = random.sample(consolidate_coupons, min(num_consolidate_redemptions, len(consolidate_coupons)))
    
    transfer_coupons_list = [c for c in coupons_created if c.acquisition_method in ['transfer', 'public_pool']]
    num_transfer_redemptions = int(len(transfer_coupons_list) * config.circulation_redemption_ratio)
    transfer_to_redeem = random.sample(transfer_coupons_list, min(num_transfer_redemptions, len(transfer_coupons_list)))
    
    all_to_redeem = consolidate_to_redeem + transfer_to_redeem
    all_to_redeem = all_to_redeem[:total_redemptions]  # Ensure we don't exceed total
    
    for coupon in all_to_redeem:
        days_ago = random.randint(0, config.time_range_days - 1)
        redemption_date = now - timedelta(days=days_ago)
        
        is_nearby = random.random() < 0.7
        if is_nearby:
            redemption_lat = store_lat + random.uniform(-offset, offset)
            redemption_lng = store_lng + random.uniform(-offset, offset)
        else:
            redemption_lat = store_lat + random.uniform(0.01, 0.02)
            redemption_lng = store_lng + random.uniform(0.01, 0.02)
        
        CouponRedemption.objects.create(
            coupon=coupon,
            user=coupon.current_holder,
            redeemed_at=redemption_date,
            savings_amount=coupon.estimated_savings,
            lat=redemption_lat,
            lng=redemption_lng,
        )
        redemptions_created += 1
    
    return {
        'templates': templates,
        'coupons': coupons_created,
        'logs': logs_created,
        'redemptions': redemptions_created,
        'share_requests': share_requests_created
    }


def generate_stage5_data(store, tags, students, config: Stage5Config):
    """Generate data for Stage 5: Trends & Edge Cases."""
    now = timezone.now()
    templates = []
    
    # Generate edge case scenarios
    edge_cases = []
    
    # 1. Empty data scenario
    if 'empty_data' in config.edge_case_scenarios:
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name='Empty_Data_Template',
            defaults={
                'coupon_detail': 'Empty data test template',
                'important_notes': 'No views or redemptions',
                'start_date': now - timedelta(days=30),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': 50,
                'remaining_quantity': 50,
                'draw_probability': 0.3,
                'template_redeem_code': 'EMPTY',
                'estimated_savings': 100.00,
                'is_active': True
            }
        )
        templates.append(template)
        edge_cases.append(('empty_data', template))
    
    # 2. High redemption rate
    if 'high_redemption_rate' in config.edge_case_scenarios:
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name='High_Redemption_Template',
            defaults={
                'coupon_detail': 'High redemption rate test',
                'important_notes': '95% redemption rate',
                'start_date': now - timedelta(days=30),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': 100,
                'remaining_quantity': 100,
                'draw_probability': 0.3,
                'template_redeem_code': 'HIGH',
                'estimated_savings': 100.00,
                'is_active': True
            }
        )
        templates.append(template)
        edge_cases.append(('high_redemption', template))
    
    # 3. Low conversion rate
    if 'low_conversion_rate' in config.edge_case_scenarios:
        template, _ = CouponTemplate.objects.get_or_create(
            store=store,
            coupon_name='Low_Conversion_Template',
            defaults={
                'coupon_detail': 'Low conversion rate test',
                'important_notes': '1000 views, 2 redemptions',
                'start_date': now - timedelta(days=30),
                'expiry_date': now + timedelta(days=30),
                'total_quantity': 50,
                'remaining_quantity': 50,
                'draw_probability': 0.3,
                'template_redeem_code': 'LOW',
                'estimated_savings': 100.00,
                'is_active': True
            }
        )
        templates.append(template)
        edge_cases.append(('low_conversion', template))
    
    # Generate data for each edge case
    coupons_created = []
    logs_created = 0
    redemptions_created = 0
    
    for case_name, template in edge_cases:
        if case_name == 'empty_data':
            # No data generation
            continue
        elif case_name == 'high_redemption':
            # Generate coupons and high redemption rate
            case_coupons = []  # Separate list for this case
            num_coupons = min(template.total_quantity, len(students))
            selected_students = random.sample(students, num_coupons) if len(students) >= num_coupons else students
            
            for student_user, _ in selected_students:
                coupon = template.generate_coupon(recipient=student_user)
                if coupon:
                    coupon.acquisition_method = 'consolidate'
                    coupon.save()
                    case_coupons.append(coupon)
                    coupons_created.append(coupon)
            
            # High redemption rate
            num_redemptions = int(len(case_coupons) * config.high_redemption_rate)
            coupons_to_redeem = random.sample(case_coupons, min(num_redemptions, len(case_coupons)))
            
            for coupon in coupons_to_redeem:
                days_ago = random.randint(0, 29)
                redemption_date = now - timedelta(days=days_ago)
                CouponRedemption.objects.create(
                    coupon=coupon,
                    user=coupon.current_holder,
                    redeemed_at=redemption_date,
                    savings_amount=coupon.estimated_savings,
                )
                redemptions_created += 1
        elif case_name == 'low_conversion':
            # Generate many views but few redemptions
            for i in range(config.low_conversion_exposures):
                days_ago = random.randint(0, 29)
                view_date = now - timedelta(days=days_ago)
                user = random.choice(students)[0] if random.random() < 0.7 else None
                
                log = Log.objects.create(
                    action='template_view',
                    user=user,
                    template=template,
                    timestamp=view_date,
                )
                logs_created += 1
            
            # Generate coupons and few redemptions
            case_coupons = []  # Separate list for this case
            num_coupons = min(template.total_quantity, len(students))
            selected_students = random.sample(students, num_coupons) if len(students) >= num_coupons else students
            
            for student_user, _ in selected_students:
                coupon = template.generate_coupon(recipient=student_user)
                if coupon:
                    coupon.acquisition_method = 'consolidate'
                    coupon.save()
                    case_coupons.append(coupon)
                    coupons_created.append(coupon)
            
            # Only few redemptions
            coupons_to_redeem = random.sample(case_coupons, min(config.low_conversion_redemptions, len(case_coupons)))
            for coupon in coupons_to_redeem:
                days_ago = random.randint(0, 29)
                redemption_date = now - timedelta(days=days_ago)
                CouponRedemption.objects.create(
                    coupon=coupon,
                    user=coupon.current_holder,
                    redeemed_at=redemption_date,
                    savings_amount=coupon.estimated_savings,
                )
                redemptions_created += 1
    
    return {
        'templates': templates,
        'coupons': coupons_created,
        'logs': logs_created,
        'redemptions': redemptions_created
    }


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Generate test data for merchant statistics testing')
    parser.add_argument('--stage', type=int, choices=[1, 2, 3, 4, 5], help='Generate data for specific stage')
    parser.add_argument('--config', type=str, help='Path to JSON config file')
    parser.add_argument('--scenario', type=str, help='Predefined scenario name')
    
    # Stage 1 parameters
    parser.add_argument('--num-active-templates', type=int)
    parser.add_argument('--num-inactive-templates', type=int)
    parser.add_argument('--num-store-templates', type=int)
    parser.add_argument('--total-quantity-per-template', type=int)
    parser.add_argument('--clicks-per-template', type=int)
    
    # Stage 2 parameters
    parser.add_argument('--conversion-rate', type=float)
    parser.add_argument('--time-range-days', type=int)
    parser.add_argument('--nearby-click-ratio', type=float)
    
    # Stage 3 parameters
    parser.add_argument('--num-exclusive-templates', type=int)
    parser.add_argument('--coupons-per-template', type=int)
    parser.add_argument('--redemption-rate', type=float)
    
    # Stage 4 parameters
    parser.add_argument('--stranger-acquisition-ratio', type=float)
    parser.add_argument('--sharing-rate', type=float)
    parser.add_argument('--circulation-redemption-ratio', type=float)
    
    args = parser.parse_args()
    
    if not args.stage:
        print("Error: --stage is required")
        sys.exit(1)
    
    # Load configuration
    if args.config:
        with open(args.config, 'r') as f:
            config_dict = json.load(f)
        config = load_config_from_dict(args.stage, config_dict)
    else:
        config = get_stage_config(args.stage)
        
        # Override with command line arguments
        override_dict = {}
        if args.num_active_templates is not None:
            override_dict['num_active_templates'] = args.num_active_templates
        if args.num_inactive_templates is not None:
            override_dict['num_inactive_templates'] = args.num_inactive_templates
        if args.num_store_templates is not None:
            override_dict['num_store_templates'] = args.num_store_templates
        if args.total_quantity_per_template is not None:
            override_dict['total_quantity_per_template'] = args.total_quantity_per_template
        if args.clicks_per_template is not None:
            override_dict['clicks_per_template'] = args.clicks_per_template
        if args.conversion_rate is not None:
            override_dict['conversion_rate'] = args.conversion_rate
        if args.time_range_days is not None:
            override_dict['time_range_days'] = args.time_range_days
        if args.nearby_click_ratio is not None:
            override_dict['nearby_click_ratio'] = args.nearby_click_ratio
        if args.num_exclusive_templates is not None:
            override_dict['num_exclusive_templates'] = args.num_exclusive_templates
        if args.coupons_per_template is not None:
            override_dict['coupons_per_template'] = args.coupons_per_template
        if args.redemption_rate is not None:
            override_dict['redemption_rate'] = args.redemption_rate
        if args.stranger_acquisition_ratio is not None:
            override_dict['stranger_acquisition_ratio'] = args.stranger_acquisition_ratio
        if args.sharing_rate is not None:
            override_dict['sharing_rate'] = args.sharing_rate
        if args.circulation_redemption_ratio is not None:
            override_dict['circulation_redemption_ratio'] = args.circulation_redemption_ratio
        
        if override_dict:
            config = create_custom_config(args.stage, **override_dict)
    
    if not config:
        print(f"Error: Could not create configuration for stage {args.stage}")
        sys.exit(1)
    
    print("=" * 60)
    print(f"GENERATING TEST DATA: STAGE {args.stage}")
    print(f"Description: {config.description}")
    print("=" * 60)
    print()
    
    # Create base data
    print("Creating base data...")
    tags = create_tags()
    merchant_user, merchant_profile = create_merchant()
    store = create_store(merchant_user, 250.00)
    students = create_students(count=30)
    print(f"✓ Created merchant, store, and {len(students)} students")
    
    # Generate stage-specific data
    print(f"\nGenerating Stage {args.stage} data...")
    if args.stage == 1:
        result = generate_stage1_data(store, tags, students, config)
    elif args.stage == 2:
        result = generate_stage2_data(store, tags, students, config)
    elif args.stage == 3:
        result = generate_stage3_data(store, tags, students, config)
    elif args.stage == 4:
        result = generate_stage4_data(store, tags, students, config)
    elif args.stage == 5:
        result = generate_stage5_data(store, tags, students, config)
    
    print(f"✓ Created {len(result['templates'])} templates")
    print(f"✓ Generated {len(result['coupons'])} coupons")
    print(f"✓ Created {result['logs']} log entries")
    print(f"✓ Created {result['redemptions']} redemptions")
    if 'share_requests' in result:
        print(f"✓ Created {result['share_requests']} share requests")
    
    print("\n" + "=" * 60)
    print("TEST DATA GENERATION COMPLETE")
    print("=" * 60)


if __name__ == '__main__':
    main()

