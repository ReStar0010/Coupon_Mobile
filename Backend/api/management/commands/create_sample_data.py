from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import timedelta
from api.models import Store, Coupon, CouponTemplate, Tag, StudentProfile, MerchantProfile

class Command(BaseCommand):
    help = 'Create sample coupons, stores, tags, and users for testing'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS('開始創建測試資料...'))
        
        # 1. 創建或獲取標籤
        self.stdout.write('創建標籤...')
        tags_data = [
            {'name': 'food', 'display_name': '食物'},
            {'name': 'drink', 'display_name': '飲品'},
            {'name': 'entertainment', 'display_name': '娛樂'},
            {'name': 'shopping', 'display_name': '購物'},
            {'name': 'travel', 'display_name': '旅遊'},
            {'name': 'health', 'display_name': '健康'},
            {'name': 'discount', 'display_name': '折扣'},
            {'name': 'coffee', 'display_name': '咖啡'},
            {'name': 'restaurant', 'display_name': '餐廳'},
            {'name': 'fastfood', 'display_name': '速食'},
        ]
        
        tags = {}
        for tag_data in tags_data:
            tag, created = Tag.objects.get_or_create(
                name=tag_data['name'],
                defaults={'display_name': tag_data['display_name']}
            )
            tags[tag_data['name']] = tag
            if created:
                self.stdout.write(self.style.SUCCESS(f'  創建標籤: {tag.display_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'  標籤已存在: {tag.display_name}'))
        
        # 2. 創建 Merchant 用戶和群組
        self.stdout.write('\n創建 Merchant 用戶...')
        merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        
        merchant_user, created = User.objects.get_or_create(
            username='test_merchant',
            defaults={
                'email': 'merchant@test.com',
                'first_name': '測試',
                'last_name': '商家'
            }
        )
        merchant_user.set_password('test123456')
        merchant_user.groups.add(merchant_group)
        merchant_user.save()
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'  創建 Merchant 用戶: {merchant_user.email}'))
        else:
            self.stdout.write(self.style.WARNING(f'  Merchant 用戶已存在: {merchant_user.email}'))
        
        # 創建 Merchant Profile
        merchant_profile, _ = MerchantProfile.objects.get_or_create(
            user=merchant_user,
            defaults={
                'phone': '0912345678',
                'contact_person': '測試商家',
                'contact_info': 'line_id: test_merchant'
            }
        )
        
        # 3. 創建 Student 用戶
        self.stdout.write('\n創建 Student 用戶...')
        student_user, created = User.objects.get_or_create(
            username='test_student',
            defaults={
                'email': 'student@test.com',
                'first_name': '測試',
                'last_name': '學生'
            }
        )
        student_user.set_password('test123456')
        student_user.save()
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'  創建 Student 用戶: {student_user.email}'))
        else:
            self.stdout.write(self.style.WARNING(f'  Student 用戶已存在: {student_user.email}'))
        
        # 創建 Student Profile
        student_profile, _ = StudentProfile.objects.get_or_create(
            user=student_user,
            defaults={'verified': True}
        )
        
        # 4. 創建商店
        self.stdout.write('\n創建商店...')
        stores_data = [
            {
                'name': '星巴克咖啡',
                'lat': 25.0330,
                'lng': 121.5654,
                'address': '台北市信義區信義路五段7號',
                'business_hours': '週一至週日 07:00-22:00'
            },
            {
                'name': '麥當勞',
                'lat': 25.0400,
                'lng': 121.5700,
                'address': '台北市信義區市府路1號',
                'business_hours': '週一至週日 24小時'
            },
            {
                'name': '85度C',
                'lat': 25.0300,
                'lng': 121.5600,
                'address': '台北市信義區松仁路100號',
                'business_hours': '週一至週日 07:00-23:00'
            },
            {
                'name': '誠品書店',
                'lat': 25.0350,
                'lng': 121.5680,
                'address': '台北市信義區松高路11號',
                'business_hours': '週一至週日 10:00-22:00'
            },
            {
                'name': '家樂福',
                'lat': 25.0380,
                'lng': 121.5650,
                'address': '台北市信義區松高路19號',
                'business_hours': '週一至週日 09:00-23:00'
            },
        ]
        
        created_stores = []
        for store_data in stores_data:
            store, created = Store.objects.get_or_create(
                owner=merchant_user,
                name=store_data['name'],
                defaults={
                    'lat': store_data['lat'],
                    'lng': store_data['lng'],
                    'address': store_data['address'],
                    'business_hours': store_data['business_hours']
                }
            )
            created_stores.append(store)
            if created:
                self.stdout.write(self.style.SUCCESS(f'  創建商店: {store.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'  商店已存在: {store.name}'))
        
        # 5. 創建店家優惠券（store type）
        self.stdout.write('\n創建店家優惠券...')
        now = timezone.now()
        
        store_coupons_data = [
            {
                'store': created_stores[0],  # 星巴克
                'coupon_name': '咖啡買一送一',
                'coupon_detail': '任何咖啡飲品買一送一，限同品項',
                'important_notes': '不適用於特殊節日，需現場購買',
                'estimated_savings': 150.00,
                'tag_names': ['drink', 'coffee', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400'
            },
            {
                'store': created_stores[0],  # 星巴克
                'coupon_name': '早餐套餐優惠',
                'coupon_detail': '購買早餐套餐享9折優惠',
                'important_notes': '限早餐時段使用',
                'estimated_savings': 50.00,
                'tag_names': ['food', 'coffee', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400'
            },
            {
                'store': created_stores[1],  # 麥當勞
                'coupon_name': '超值全餐優惠',
                'coupon_detail': '購買超值全餐享85折優惠',
                'important_notes': '不與其他優惠併用',
                'estimated_savings': 30.00,
                'tag_names': ['food', 'fastfood', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'
            },
            {
                'store': created_stores[1],  # 麥當勞
                'coupon_name': '飲料第二杯半價',
                'coupon_detail': '購買任何飲料，第二杯享半價優惠',
                'important_notes': '限同品項',
                'estimated_savings': 25.00,
                'tag_names': ['drink', 'fastfood', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400'
            },
            {
                'store': created_stores[2],  # 85度C
                'coupon_name': '蛋糕85折',
                'coupon_detail': '購買任何蛋糕享85折優惠',
                'important_notes': '限現場購買',
                'estimated_savings': 40.00,
                'tag_names': ['food', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'
            },
            {
                'store': created_stores[3],  # 誠品書店
                'coupon_name': '書籍9折優惠',
                'coupon_detail': '購買書籍享9折優惠，不限金額',
                'important_notes': '不適用於特價商品',
                'estimated_savings': 100.00,
                'tag_names': ['shopping', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400'
            },
            {
                'store': created_stores[4],  # 家樂福
                'coupon_name': '滿千送百',
                'coupon_detail': '單筆消費滿1000元，現折100元',
                'important_notes': '限當日使用，不累積',
                'estimated_savings': 100.00,
                'tag_names': ['shopping', 'discount'],
                'image_url': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400'
            },
        ]
        
        for coupon_data in store_coupons_data:
            coupon, created = Coupon.objects.get_or_create(
                store=coupon_data['store'],
                coupon_name=coupon_data['coupon_name'],
                defaults={
                    'coupon_detail': coupon_data['coupon_detail'],
                    'important_notes': coupon_data['important_notes'],
                    'start_date': now,
                    'expiry_date': now + timedelta(days=30),
                    'coupon_type': 'store',
                    'estimated_savings': coupon_data['estimated_savings'],
                    'image_url': coupon_data.get('image_url', ''),
                    'usage_per_day': 'unlimited'
                }
            )
            
            # 添加標籤
            for tag_name in coupon_data['tag_names']:
                if tag_name in tags:
                    coupon.tags.add(tags[tag_name])
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'  創建優惠券: {coupon.coupon_name} ({coupon.store.name})'))
            else:
                self.stdout.write(self.style.WARNING(f'  優惠券已存在: {coupon.coupon_name}'))
        
        # 6. 創建專屬優惠券模板（用於每日抽獎）
        self.stdout.write('\n創建專屬優惠券模板...')
        template_data = [
            {
                'store': created_stores[0],  # 星巴克
                'coupon_name': '星巴克專屬優惠券',
                'coupon_detail': '憑此券可享任何飲品8折優惠',
                'important_notes': '限本人使用，不可轉讓',
                'estimated_savings': 80.00,
                'tag_names': ['drink', 'coffee', 'discount'],
                'total_quantity': 10,
                'draw_probability': 0.3,
                'template_redeem_code': 'STAR01',
                'image_url': 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400'
            },
            {
                'store': created_stores[1],  # 麥當勞
                'coupon_name': '麥當勞專屬優惠券',
                'coupon_detail': '憑此券可享套餐9折優惠',
                'important_notes': '限本人使用',
                'estimated_savings': 40.00,
                'tag_names': ['food', 'fastfood', 'discount'],
                'total_quantity': 15,
                'draw_probability': 0.5,
                'template_redeem_code': 'MCD01',
                'image_url': 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'
            },
        ]
        
        for template_info in template_data:
            template, created = CouponTemplate.objects.get_or_create(
                store=template_info['store'],
                coupon_name=template_info['coupon_name'],
                defaults={
                    'coupon_detail': template_info['coupon_detail'],
                    'important_notes': template_info['important_notes'],
                    'start_date': now,
                    'expiry_date': now + timedelta(days=30),
                    'total_quantity': template_info['total_quantity'],
                    'remaining_quantity': template_info['total_quantity'],
                    'draw_probability': template_info['draw_probability'],
                    'template_redeem_code': template_info['template_redeem_code'],
                    'image_url': template_info.get('image_url', ''),
                    'estimated_savings': template_info['estimated_savings'],
                    'is_active': True
                }
            )
            
            # 添加標籤
            for tag_name in template_info['tag_names']:
                if tag_name in tags:
                    template.tags.add(tags[tag_name])
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'  創建優惠券模板: {template.coupon_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'  優惠券模板已存在: {template.coupon_name}'))
        
        # 7. 為測試學生創建一些專屬優惠券
        self.stdout.write('\n為測試學生創建專屬優惠券...')
        exclusive_coupon = Coupon.objects.create(
            store=created_stores[0],
            coupon_name='星巴克專屬優惠券',
            coupon_detail='憑此券可享任何飲品8折優惠',
            important_notes='限本人使用，不可轉讓',
            start_date=now,
            expiry_date=now + timedelta(days=30),
            coupon_type='exclusive',
            estimated_savings=80.00,
            original_owner=student_user,
            current_holder=student_user,
            redeem_code='STAR01',
            image_url='https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400',
            usage_per_day='unlimited'
        )
        exclusive_coupon.tags.add(tags['drink'], tags['coffee'], tags['discount'])
        self.stdout.write(self.style.SUCCESS(f'  創建專屬優惠券: {exclusive_coupon.coupon_name}'))
        
        self.stdout.write(self.style.SUCCESS('\n✅ 測試資料創建完成！'))
        self.stdout.write(self.style.SUCCESS('\n測試帳號資訊：'))
        self.stdout.write(self.style.SUCCESS('  Merchant: merchant@test.com / test123456'))
        self.stdout.write(self.style.SUCCESS('  Student: student@test.com / test123456'))
        self.stdout.write(self.style.SUCCESS(f'\n已創建：'))
        self.stdout.write(self.style.SUCCESS(f'  - {len(tags)} 個標籤'))
        self.stdout.write(self.style.SUCCESS(f'  - {len(created_stores)} 個商店'))
        self.stdout.write(self.style.SUCCESS(f'  - {len(store_coupons_data)} 個店家優惠券'))
        self.stdout.write(self.style.SUCCESS(f'  - {len(template_data)} 個優惠券模板'))
        self.stdout.write(self.style.SUCCESS(f'  - 1 個專屬優惠券'))

