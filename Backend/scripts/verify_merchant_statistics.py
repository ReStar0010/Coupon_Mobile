#!/usr/bin/env python
"""
Verification tool for merchant statistics.
Provides DB query and API comparison functionality for validating statistics.
"""
import os
import sys
import django
import argparse
import requests
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import timedelta
from django.utils import timezone

# Add the Backend directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module to test_settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.test_settings')

# Setup Django
django.setup()

from api.models import (
    Store, Coupon, CouponTemplate, CouponRedemption, 
    Log, CouponShareRequest
)

# Test configuration
BASE_URL = "http://localhost:8001"
MERCHANT_EMAIL = "merchant@demo.com"
MERCHANT_PASSWORD = "demo123456"


class StatisticsVerifier:
    """Tool for verifying merchant statistics by comparing DB queries with API responses."""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.token = None
    
    def authenticate(self) -> bool:
        """Authenticate as merchant and get token."""
        try:
            response = requests.post(
                f"{self.base_url}/api/login/",
                json={
                    "email": MERCHANT_EMAIL,
                    "password": MERCHANT_PASSWORD
                }
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('access_token')
                return self.token is not None
            return False
        except Exception as e:
            print(f"Authentication failed: {e}")
            return False
    
    def _make_request(self, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make an authenticated API request."""
        if not self.token:
            return None
        
        headers = {"Authorization": f"Bearer {self.token}"}
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def verify_basic_statistics(self, store: Store) -> Dict[str, Tuple[Any, Any, bool]]:
        """Verify basic statistics API."""
        results = {}
        
        # DB queries
        active_count = CouponTemplate.objects.filter(store=store, is_active=True).count()
        total_templates = CouponTemplate.objects.filter(store=store).count()
        total_coupons = Coupon.objects.filter(store=store, template__isnull=False).count()
        total_views = Log.objects.filter(template__store=store, action='template_view').count()
        total_redemptions = CouponRedemption.objects.filter(coupon__store=store).count()
        
        # API call
        api_data = self._make_request("/api/merchant/statistics/")
        
        if api_data:
            results['active_coupons'] = (
                api_data.get('active_coupons', 0),
                active_count,
                api_data.get('active_coupons', 0) == active_count
            )
            results['total_templates'] = (
                api_data.get('total_templates', 0),
                total_templates,
                api_data.get('total_templates', 0) == total_templates
            )
            results['total_coupons_generated'] = (
                api_data.get('total_coupons_generated', 0),
                total_coupons,
                api_data.get('total_coupons_generated', 0) == total_coupons
            )
            results['total_views'] = (
                api_data.get('total_views', 0),
                total_views,
                api_data.get('total_views', 0) == total_views
            )
            results['total_redemptions'] = (
                api_data.get('total_redemptions', 0),
                total_redemptions,
                api_data.get('total_redemptions', 0) == total_redemptions
            )
        
        return results
    
    def verify_store_template_analytics(self, template: CouponTemplate, days: int = 30) -> Dict[str, Tuple[Any, Any, bool, float]]:
        """Verify EasyUse (store) template analytics."""
        results = {}
        
        # DB queries
        exposure_count = Log.objects.filter(template=template, action='template_view').count()
        redemption_count = CouponRedemption.objects.filter(
            coupon__template=template,
            coupon__coupon_type='store'
        ).count()
        conversion_rate = redemption_count / exposure_count if exposure_count > 0 else 0
        
        # Time range filtering
        time_threshold = timezone.now() - timedelta(days=days)
        exposure_in_range = Log.objects.filter(
            template=template,
            action='template_view',
            timestamp__gte=time_threshold
        ).count()
        
        # API call
        api_data = self._make_request(f"/api/merchant/coupon-templates/{template.id}/analytics/", {"days": days})
        
        if api_data:
            api_exposure = api_data.get('exposure_count', 0)
            api_conversion = api_data.get('conversion_rate', 0)
            
            exposure_diff = abs(api_exposure - exposure_count)
            conversion_diff = abs(api_conversion - conversion_rate)
            
            results['exposure_count'] = (
                api_exposure,
                exposure_count,
                exposure_diff <= 0,
                exposure_diff
            )
            results['conversion_rate'] = (
                api_conversion,
                conversion_rate,
                conversion_diff <= 0.001,  # 0.1% tolerance
                conversion_diff
            )
            
            # Verify daily data length
            trends = api_data.get('trends', {})
            exposure_trend = trends.get('exposure_count', {})
            daily_data = exposure_trend.get('daily_data', [])
            expected_days = days + 1  # Including today
            
            results['daily_data_length'] = (
                len(daily_data),
                expected_days,
                len(daily_data) == expected_days,
                0
            )
        
        return results
    
    def verify_exclusive_template_analytics(self, template: CouponTemplate, days: int = 30) -> Dict[str, Tuple[Any, Any, bool, float]]:
        """Verify Exclusive template analytics."""
        results = {}
        
        # DB queries for basic metrics
        exposure_count = Log.objects.filter(template=template, action='template_view').count()
        exclusive_redemptions = CouponRedemption.objects.filter(
            coupon__template=template,
            coupon__coupon_type='exclusive'
        )
        redemption_count = exclusive_redemptions.count()
        conversion_rate = redemption_count / exposure_count if exposure_count > 0 else 0
        redemption_rate = redemption_count / template.total_quantity if template.total_quantity > 0 else 0
        
        # DB queries for advanced metrics
        # Retention cohort includes:
        # - consolidate: Merchant manual assignment via phone number
        # - qr_claim: User directly scans merchant QR to acquire coupon
        RETENTION_ACQUISITION_METHODS = ('consolidate', 'qr_claim')
        retention_coupons = Coupon.objects.filter(
            template=template,
            acquisition_method__in=RETENTION_ACQUISITION_METHODS
        )
        retention_issued_count = retention_coupons.count()
        retention_redemptions = exclusive_redemptions.filter(
            coupon__acquisition_method__in=RETENTION_ACQUISITION_METHODS
        )
        retention_redemption_count = retention_redemptions.count()
        retention_rate = retention_redemption_count / retention_issued_count if retention_issued_count > 0 else 0
        
        non_retention_redemptions = exclusive_redemptions.exclude(
            coupon__acquisition_method__in=RETENTION_ACQUISITION_METHODS
        )
        non_retention_count = non_retention_redemptions.count()
        stranger_acquisition_rate = non_retention_count / redemption_count if redemption_count > 0 else 0
        
        total_coupons = Coupon.objects.filter(template=template).count()
        transfer_coupons = Coupon.objects.filter(
            template=template,
            acquisition_method__in=['transfer', 'public_pool']
        )
        transfer_count = transfer_coupons.count()
        circulation_rate = transfer_count / total_coupons if total_coupons > 0 else 0
        
        transfer_redemptions = exclusive_redemptions.filter(coupon__acquisition_method__in=['transfer', 'public_pool'])
        transfer_redemption_count = transfer_redemptions.count()
        circulation_redemption_rate = transfer_redemption_count / transfer_count if transfer_count > 0 else 0
        
        # API call
        api_data = self._make_request(f"/api/merchant/coupon-templates/{template.id}/analytics/", {"days": days})
        
        if api_data:
            # Basic metrics
            api_exposure = api_data.get('exposure_count', 0)
            api_conversion = api_data.get('conversion_rate', 0)
            api_redemption_rate = api_data.get('redemption_rate', 0)
            
            results['exposure_count'] = (
                api_exposure,
                exposure_count,
                abs(api_exposure - exposure_count) <= 0,
                abs(api_exposure - exposure_count)
            )
            results['conversion_rate'] = (
                api_conversion,
                conversion_rate,
                abs(api_conversion - conversion_rate) <= 0.01,  # 1% tolerance
                abs(api_conversion - conversion_rate)
            )
            results['redemption_rate'] = (
                api_redemption_rate,
                redemption_rate,
                abs(api_redemption_rate - redemption_rate) <= 0.01,  # 1% tolerance
                abs(api_redemption_rate - redemption_rate)
            )
            
            # Advanced metrics
            api_retention = api_data.get('retention_rate', 0)
            api_stranger = api_data.get('stranger_acquisition_rate', 0)
            api_circulation = api_data.get('circulation_rate', 0)
            api_circulation_redemption = api_data.get('circulation_redemption_rate', 0)
            
            results['retention_rate'] = (
                api_retention,
                retention_rate,
                abs(api_retention - retention_rate) <= 0.02,  # 2% tolerance
                abs(api_retention - retention_rate)
            )
            results['stranger_acquisition_rate'] = (
                api_stranger,
                stranger_acquisition_rate,
                abs(api_stranger - stranger_acquisition_rate) <= 0.02,  # 2% tolerance
                abs(api_stranger - stranger_acquisition_rate)
            )
            results['circulation_rate'] = (
                api_circulation,
                circulation_rate,
                abs(api_circulation - circulation_rate) <= 0.02,  # 2% tolerance
                abs(api_circulation - circulation_rate)
            )
            results['circulation_redemption_rate'] = (
                api_circulation_redemption,
                circulation_redemption_rate,
                abs(api_circulation_redemption - circulation_redemption_rate) <= 0.02,  # 2% tolerance
                abs(api_circulation_redemption - circulation_redemption_rate)
            )
            
            # Verify daily data
            trends = api_data.get('trends', {})
            expected_days = days + 1
            
            for metric_name in ['exposure_count', 'conversion_rate', 'redemption_rate', 
                               'retention_rate', 'stranger_acquisition_rate', 
                               'circulation_rate', 'circulation_redemption_rate']:
                if metric_name in trends:
                    daily_data = trends[metric_name].get('daily_data', [])
                    results[f'{metric_name}_daily_length'] = (
                        len(daily_data),
                        expected_days,
                        len(daily_data) == expected_days,
                        0
                    )
        
        return results
    
    def verify_template(self, template_id: int, days: int = 30) -> Dict[str, Any]:
        """Verify a specific template's analytics."""
        try:
            template = CouponTemplate.objects.get(id=template_id)
            is_store_template = template.total_quantity == 0
            
            if is_store_template:
                return self.verify_store_template_analytics(template, days)
            else:
                return self.verify_exclusive_template_analytics(template, days)
        except CouponTemplate.DoesNotExist:
            print(f"Template {template_id} not found")
            return {}
    
    def verify_all_templates(self, store: Store, days: int = 30) -> Dict[int, Dict[str, Any]]:
        """Verify all templates for a store."""
        templates = CouponTemplate.objects.filter(store=store)
        results = {}
        
        for template in templates:
            if template.total_quantity == 0:
                results[template.id] = self.verify_store_template_analytics(template, days)
            else:
                results[template.id] = self.verify_exclusive_template_analytics(template, days)
        
        return results


def print_verification_results(results: Dict[str, Any], title: str = "Verification Results"):
    """Print verification results in a readable format."""
    print(f"\n{'=' * 60}")
    print(title)
    print('=' * 60)
    
    passed = 0
    failed = 0
    
    for metric, values in results.items():
        if len(values) == 3:  # Basic statistics (no difference)
            api_val, db_val, passed_check = values
            status = "✓ PASS" if passed_check else "✗ FAIL"
            print(f"{metric}:")
            print(f"  API Value:    {api_val}")
            print(f"  DB Expected:  {db_val}")
            print(f"  Status:       {status}")
            if passed_check:
                passed += 1
            else:
                failed += 1
        elif len(values) == 4:  # Template analytics (with difference)
            api_val, db_val, passed_check, diff = values
            status = "✓ PASS" if passed_check else "✗ FAIL"
            print(f"{metric}:")
            print(f"  API Value:    {api_val}")
            print(f"  DB Expected:  {db_val}")
            print(f"  Difference:   {diff:.6f}")
            print(f"  Status:       {status}")
            if passed_check:
                passed += 1
            else:
                failed += 1
    
    print(f"\n{'=' * 60}")
    print(f"Summary: {passed} passed, {failed} failed")
    print('=' * 60)


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Verify merchant statistics')
    parser.add_argument('--template-id', type=int, help='Verify a specific template')
    parser.add_argument('--all', action='store_true', help='Verify all templates')
    parser.add_argument('--days', type=int, default=30, help='Time range in days')
    parser.add_argument('--url', type=str, default=BASE_URL, help='Base URL for API')
    
    args = parser.parse_args()
    
    verifier = StatisticsVerifier(base_url=args.url)
    
    if not verifier.authenticate():
        print("Failed to authenticate. Make sure:")
        print("1. Test server is running (./run_test_server.sh)")
        print("2. Merchant account exists (merchant@demo.com / demo123456)")
        sys.exit(1)
    
    store = Store.objects.filter(owner__email=MERCHANT_EMAIL).first()
    if not store:
        print("Store not found for merchant")
        sys.exit(1)
    
    if args.template_id:
        results = verifier.verify_template(args.template_id, args.days)
        print_verification_results(results, f"Template {args.template_id} Verification")
    elif args.all:
        # Verify basic statistics
        basic_results = verifier.verify_basic_statistics(store)
        print_verification_results(basic_results, "Basic Statistics Verification")
        
        # Verify all templates
        template_results = verifier.verify_all_templates(store, args.days)
        for template_id, results in template_results.items():
            template = CouponTemplate.objects.get(id=template_id)
            print_verification_results(results, f"Template {template_id} ({template.coupon_name}) Verification")
    else:
        # Default: verify basic statistics
        results = verifier.verify_basic_statistics(store)
        print_verification_results(results, "Basic Statistics Verification")


if __name__ == '__main__':
    main()

