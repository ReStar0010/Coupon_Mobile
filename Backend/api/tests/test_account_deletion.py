"""
Tests for merchant account deletion functionality.
Requirements: Password verification, data anonymization, coupon preservation.
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from api.models import (
    Store, MerchantProfile, CouponTemplate, Coupon,
    AccountDeletionLog
)
from datetime import timedelta


class AccountDeletionTestCase(TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.client = APIClient()
        
        # Create merchant group
        self.merchant_group = Group.objects.get_or_create(name='Merchant')[0]
        
        # Create test merchant user
        self.merchant = User.objects.create_user(
            username='testmerchant@test.com',
            email='testmerchant@test.com',
            password='testpass123'
        )
        self.merchant.groups.add(self.merchant_group)
        
        # Create merchant profile
        self.merchant_profile = MerchantProfile.objects.create(
            user=self.merchant,
            phone='0912345678',
            contact_person='測試商家',
            contact_info='Line: testmerchant'
        )
        
        # Create test store
        self.store = Store.objects.create(
            owner=self.merchant,
            name='測試茶飲店',
            lat=25.0330,
            lng=121.5654,
            address='台北市信義區測試路123號',
            business_hours='09:00-22:00',
            image_url='https://example.com/store.jpg',
            store_type='restaurant'
        )
        
        # Login merchant
        self.client.force_authenticate(user=self.merchant)
    
    def test_password_verification_required(self):
        """Test that incorrect password is rejected"""
        response = self.client.post('/api/merchant/account/delete/', {
            'password': 'wrongpassword',
            'acknowledgments': ['ACTIVE_COUPONS', 'DATA_LOSS']
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error'], '密碼錯誤')
        
        # Verify user still exists
        self.assertTrue(User.objects.filter(id=self.merchant.id).exists())
    
    def test_pre_delete_check_with_active_coupons(self):
        """Test pre-delete check returns warning for active coupons"""
        # Create coupon template and coupons
        template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='測試優惠券',
            coupon_detail='買一送一',
            total_quantity=10,
            remaining_quantity=5,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )
        
        response = self.client.get('/api/merchant/account/pre-delete-check/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_delete'])
        self.assertEqual(response.data['data_summary']['stores_count'], 1)
        self.assertIsInstance(response.data['warnings'], list)
    
    def test_successful_deletion_with_store_anonymization(self):
        """Test successful account deletion anonymizes store data"""
        # Create active coupons
        template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='測試優惠券',
            coupon_detail='買一送一',
            total_quantity=10,
            remaining_quantity=5,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30)
        )
        
        original_store_id = self.store.id
        
        response = self.client.post('/api/merchant/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': ['ACTIVE_COUPONS', 'DATA_LOSS']
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        
        # Verify user is deleted
        self.assertFalse(User.objects.filter(id=self.merchant.id).exists())
        
        # Verify store is anonymized but preserved
        store = Store.objects.get(id=original_store_id)
        self.assertEqual(store.name, '已刪除的商家')
        self.assertEqual(store.address, '')
        self.assertIsNone(store.lat)
        self.assertIsNone(store.lng)
        self.assertIsNone(store.image_url)
        self.assertIsNone(store.unified_redeem_code)
        self.assertIsNone(store.owner)
        
        # Verify AccountDeletionLog was created
        log = AccountDeletionLog.objects.filter(
            deleted_user_email='testmerchant@test.com'
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, 'completed')
        self.assertEqual(log.stores_anonymized, 1)
    
    def test_deletion_with_multiple_stores(self):
        """Test deletion handles multiple stores correctly"""
        # Create second store
        store2 = Store.objects.create(
            owner=self.merchant,
            name='測試咖啡店',
            lat=25.0400,
            lng=121.5700,
            address='台北市大安區測試路456號',
            store_type='restaurant'
        )
        
        response = self.client.post('/api/merchant/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': ['DATA_LOSS']
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify both stores are anonymized
        for store_id in [self.store.id, store2.id]:
            store = Store.objects.get(id=store_id)
            self.assertEqual(store.name, '已刪除的商家')
            self.assertIsNone(store.owner)
        
        # Verify log shows correct count
        log = AccountDeletionLog.objects.filter(
            deleted_user_email='testmerchant@test.com'
        ).first()
        self.assertEqual(log.stores_anonymized, 2)
    
    def test_invalid_password_rejection(self):
        """Test that invalid password prevents deletion"""
        response = self.client.post('/api/merchant/account/delete/', {
            'password': 'wrongpass',
            'acknowledgments': ['DATA_LOSS']
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('密碼錯誤', response.data.get('error', ''))
    
    def test_deletion_log_status_transitions(self):
        """Test that AccountDeletionLog captures correct status"""
        merchant_id = self.merchant.id  # Save ID before deletion
        
        response = self.client.post('/api/merchant/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': ['DATA_LOSS']
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        log = AccountDeletionLog.objects.filter(
            deleted_user_email='testmerchant@test.com'
        ).first()
        
        self.assertIsNotNone(log)
        self.assertEqual(log.status, 'completed')
        self.assertIsNotNone(log.initiated_at)
        self.assertIsNotNone(log.completed_at)
        self.assertEqual(log.deleted_user_id, merchant_id)
    
    def test_deleted_user_cannot_login(self):
        """Test that deleted user cannot authenticate"""
        # Delete account
        self.client.post('/api/merchant/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': ['DATA_LOSS']
        }, format='json')
        
        # Try to login
        client = APIClient()
        response = client.post('/api/merchant/login/', {
            'email': 'testmerchant@test.com',
            'password': 'testpass123'
        }, format='json')
        
        self.assertNotEqual(response.status_code, status.HTTP_200_OK)
    
    def test_deleted_email_can_register_again(self):
        """Test that deleted email can be used for new registration"""
        # Delete account
        self.client.post('/api/merchant/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': ['DATA_LOSS']
        }, format='json')
        
        # Verify email is now available (user is deleted)
        user_exists = User.objects.filter(email='testmerchant@test.com').exists()
        self.assertFalse(user_exists, "Deleted user email should be available for re-registration")
        
        # Try to create new user with same email (should succeed)
        new_user = User.objects.create_user(
            username='testmerchant@test.com',
            email='testmerchant@test.com',
            password='newpass123'
        )
        self.assertIsNotNone(new_user)
        self.assertEqual(new_user.email, 'testmerchant@test.com')

