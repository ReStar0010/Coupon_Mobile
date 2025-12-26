#!/usr/bin/env python
"""
Automated test script for merchant statistics API.
Tests the correctness of statistics calculations across different stages.

Usage:
    python test_statistics.py [--stage STAGE] [--all]
    
    --stage: Test a specific stage (1, 2, 3, 4)
    --all: Test all stages
"""
import os
import sys
import django
import argparse
import requests
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

# Add the Backend directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module to test_settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.test_settings')

# Setup Django
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from api.models import (
    Store, Coupon, CouponTemplate, CouponRedemption, 
    Log, CouponShareRequest
)

# Test configuration
BASE_URL = "http://localhost:8001"
MERCHANT_EMAIL = "merchant@demo.com"
MERCHANT_PASSWORD = "demo123456"


class TestResult:
    """Represents a test result."""
    def __init__(self, name: str, passed: bool, message: str = "", expected: Any = None, actual: Any = None):
        self.name = name
        self.passed = passed
        self.message = message
        self.expected = expected
        self.actual = actual
    
    def __str__(self):
        status = "✓ PASS" if self.passed else "✗ FAIL"
        msg = f"{status}: {self.name}"
        if self.message:
            msg += f" - {self.message}"
        if self.expected is not None and self.actual is not None:
            msg += f" (Expected: {self.expected}, Actual: {self.actual})"
        return msg


class StatisticsTester:
    """Test suite for merchant statistics APIs."""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.token = None
        self.results = []
    
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
                # API returns 'access_token' not 'access'
                self.token = data.get('access_token')
                if not self.token:
                    print(f"Warning: No access_token in response. Response: {data}")
                    return False
                return True
            else:
                error_msg = f"Status {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f": {error_data.get('error', 'Unknown error')}"
                except:
                    error_msg += f": {response.text[:100]}"
                print(f"Authentication failed: {error_msg}")
                self.results.append(TestResult(
                    "Authentication", False,
                    error_msg
                ))
                return False
        except requests.exceptions.ConnectionError:
            error_msg = f"Cannot connect to {self.base_url}. Is the server running?"
            print(f"Connection error: {error_msg}")
            self.results.append(TestResult(
                "Authentication", False,
                error_msg
            ))
            return False
        except Exception as e:
            error_msg = f"Exception during authentication: {str(e)}"
            print(f"Error: {error_msg}")
            self.results.append(TestResult(
                "Authentication", False,
                error_msg
            ))
            return False
    
    def _make_request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Optional[Dict]:
        """Make an authenticated API request."""
        if not self.token:
            print(f"Error: No token available for request to {endpoint}")
            return None
        
        headers = {"Authorization": f"Bearer {self.token}"}
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=data)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data)
            else:
                print(f"Error: Unsupported method {method}")
                return None
            
            if response.status_code == 200:
                return response.json()
            else:
                # Print detailed error for debugging
                error_msg = f"Status {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f": {error_data.get('error', error_data)}"
                except:
                    error_msg += f": {response.text[:200]}"
                print(f"Request to {endpoint} failed: {error_msg}")
                return None
        except requests.exceptions.ConnectionError:
            print(f"Connection error: Cannot connect to {url}")
            return None
        except Exception as e:
            print(f"Error making request to {endpoint}: {e}")
            return None
    
    def test_stage1_basic_statistics(self) -> list:
        """Stage 1: Test basic statistics API."""
        print("\n" + "=" * 60)
        print("STAGE 1: Basic Statistics Test")
        print("=" * 60)
        
        results = []
        data = self._make_request("/api/merchant/statistics/")
        
        if not data:
            results.append(TestResult(
                "Basic Statistics API", False,
                "Failed to get response (check server logs above)"
            ))
            return results
        
        # Get actual database counts for verification
        store = Store.objects.filter(owner__email=MERCHANT_EMAIL).first()
        if not store:
            results.append(TestResult(
                "Store Exists", False,
                "Merchant store not found"
            ))
            return results
        
        # Test active templates count
        expected_active = CouponTemplate.objects.filter(store=store, is_active=True).count()
        actual_active = data.get('active_coupons', 0)
        results.append(TestResult(
            "Active Templates Count",
            expected_active == actual_active,
            expected=expected_active,
            actual=actual_active
        ))
        
        # Test total redemptions
        expected_redemptions = CouponRedemption.objects.filter(coupon__store=store).count()
        actual_redemptions = data.get('total_redemptions', 0)
        results.append(TestResult(
            "Total Redemptions",
            expected_redemptions == actual_redemptions,
            expected=expected_redemptions,
            actual=actual_redemptions
        ))
        
        # Test total views
        expected_views = Log.objects.filter(template__store=store, action='template_view').count()
        actual_views = data.get('total_views', 0)
        results.append(TestResult(
            "Total Views",
            expected_views == actual_views,
            expected=expected_views,
            actual=actual_views
        ))
        
        # Test total templates
        expected_templates = CouponTemplate.objects.filter(store=store).count()
        actual_templates = data.get('total_templates', 0)
        results.append(TestResult(
            "Total Templates",
            expected_templates == actual_templates,
            expected=expected_templates,
            actual=actual_templates
        ))
        
        # Test total coupons generated
        expected_coupons = Coupon.objects.filter(store=store, template__isnull=False).count()
        actual_coupons = data.get('total_coupons_generated', 0)
        results.append(TestResult(
            "Total Coupons Generated",
            expected_coupons == actual_coupons,
            expected=expected_coupons,
            actual=actual_coupons
        ))
        
        return results
    
    def test_stage2_core_analytics(self) -> list:
        """Stage 2: Test core analytics calculations."""
        print("\n" + "=" * 60)
        print("STAGE 2: Core Analytics Test")
        print("=" * 60)
        
        results = []
        store = Store.objects.filter(owner__email=MERCHANT_EMAIL).first()
        if not store:
            results.append(TestResult(
                "Store Exists", False,
                "Merchant store not found"
            ))
            return results
        
        # Test with different time ranges
        for days in [7, 30, 90]:
            data = self._make_request("/api/merchant/analytics/", data={"days": days})
            if not data:
                results.append(TestResult(
                    f"Analytics API (days={days})", False,
                    "Failed to get response (check server logs above)"
                ))
                continue
            
            # Calculate expected values
            from datetime import timedelta
            now = timezone.now()
            time_threshold = now - timedelta(days=days)
            
            # Only exclusive redemptions
            exclusive_redemptions = CouponRedemption.objects.filter(
                coupon__store=store,
                coupon__coupon_type='exclusive',
                redeemed_at__gte=time_threshold
            )
            exclusive_count = exclusive_redemptions.count()
            
            # Test GMV
            expected_gmv = float(exclusive_count * (store.average_order_value or 0))
            actual_gmv = data.get('gmv', 0)
            tolerance = 0.01  # Allow small floating point differences
            results.append(TestResult(
                f"GMV Calculation (days={days})",
                abs(expected_gmv - actual_gmv) < tolerance,
                expected=expected_gmv,
                actual=actual_gmv
            ))
            
            # Test Stranger Acquisition Ratio
            if exclusive_count > 0:
                from django.db.models import F
                original_owner_count = exclusive_redemptions.filter(
                    user=F('coupon__original_owner')
                ).count()
                expected_stranger_ratio = (exclusive_count - original_owner_count) / exclusive_count
                actual_stranger_ratio = data.get('stranger_acquisition_ratio', 0)
                results.append(TestResult(
                    f"Stranger Acquisition Ratio (days={days})",
                    abs(expected_stranger_ratio - actual_stranger_ratio) < tolerance,
                    expected=expected_stranger_ratio,
                    actual=actual_stranger_ratio
                ))
            
            # Test Redemption Rate
            # API uses coupons that started before now (start_date <= now)
            exclusive_coupons = Coupon.objects.filter(
                store=store,
                coupon_type='exclusive',
                start_date__lte=now
            )
            total_coupons = exclusive_coupons.count()
            if total_coupons > 0:
                expected_redemption_rate = exclusive_count / total_coupons
                actual_redemption_rate = data.get('redemption_rate', 0)
                results.append(TestResult(
                    f"Redemption Rate (days={days})",
                    abs(expected_redemption_rate - actual_redemption_rate) < tolerance,
                    expected=expected_redemption_rate,
                    actual=actual_redemption_rate
                ))
            
            # Test Overall Conversion Rate
            template_logs = Log.objects.filter(
                template__store=store,
                action='template_view',
                timestamp__gte=time_threshold
            )
            total_clicks = template_logs.count()
            if total_clicks > 0:
                expected_conversion = exclusive_count / total_clicks
                actual_conversion = data.get('overall_conversion_rate', 0)
                results.append(TestResult(
                    f"Overall Conversion Rate (days={days})",
                    abs(expected_conversion - actual_conversion) < tolerance,
                    expected=expected_conversion,
                    actual=actual_conversion
                ))
        
        return results
    
    def test_stage3_trend_data(self) -> list:
        """Stage 3: Test trend data calculations."""
        print("\n" + "=" * 60)
        print("STAGE 3: Trend Data Test")
        print("=" * 60)
        
        results = []
        data = self._make_request("/api/merchant/analytics/", data={"days": 30})
        
        if not data:
            results.append(TestResult(
                "Trend Data API", False,
                "Failed to get response (check server logs above)"
            ))
            return results
        
        trends = data.get('trends', {})
        
        # Test that trend data exists
        required_trends = ['gmv', 'stranger_acquisition_ratio', 'coupon_activation_rate', 
                          'overall_conversion_rate', 'redemption_rate']
        
        for trend_name in required_trends:
            trend = trends.get(trend_name)
            if not trend:
                results.append(TestResult(
                    f"Trend Data: {trend_name}", False,
                    "Trend data missing"
                ))
                continue
            
            # Check structure
            has_current = 'current' in trend
            has_average = 'average' in trend
            has_daily_data = 'daily_data' in trend and isinstance(trend['daily_data'], list)
            
            results.append(TestResult(
                f"Trend Structure: {trend_name}",
                has_current and has_average and has_daily_data,
                message="Missing required fields" if not (has_current and has_average and has_daily_data) else ""
            ))
            
            # Check daily data length (should be approximately equal to days)
            if has_daily_data:
                daily_data = trend['daily_data']
                results.append(TestResult(
                    f"Daily Data Length: {trend_name}",
                    25 <= len(daily_data) <= 35,  # Allow some flexibility
                    expected="25-35 days",
                    actual=len(daily_data)
                ))
        
        return results
    
    def test_stage4_template_analytics(self) -> list:
        """Stage 4: Test template-level analytics."""
        print("\n" + "=" * 60)
        print("STAGE 4: Template Analytics Test")
        print("=" * 60)
        
        results = []
        store = Store.objects.filter(owner__email=MERCHANT_EMAIL).first()
        if not store:
            results.append(TestResult(
                "Store Exists", False,
                "Merchant store not found"
            ))
            return results
        
        # Get all templates
        templates = CouponTemplate.objects.filter(store=store)
        
        if templates.count() == 0:
            results.append(TestResult(
                "Templates Exist", False,
                "No templates found"
            ))
            return results
        
        # Test each template
        for template in templates[:3]:  # Test first 3 templates
            data = self._make_request(f"/api/merchant/coupon-templates/{template.id}/analytics/", data={"days": 30})
            
            if not data:
                results.append(TestResult(
                    f"Template Analytics API: {template.coupon_name}", False,
                    f"Failed to get response (check server logs above, template_id={template.id})"
                ))
                continue
            
            # For store templates (EasyUse), check click statistics
            if template.total_quantity == 0:
                click_count = data.get('click_count', 0)
                expected_clicks = Log.objects.filter(
                    template=template,
                    action='template_view'
                ).count()
                results.append(TestResult(
                    f"Store Template Clicks: {template.coupon_name}",
                    click_count == expected_clicks,
                    expected=expected_clicks,
                    actual=click_count
                ))
            else:
                # For exclusive templates, check GMV
                template_redemptions = CouponRedemption.objects.filter(
                    coupon__template=template,
                    coupon__coupon_type='exclusive'
                )
                expected_gmv = float(template_redemptions.count() * (store.average_order_value or 0))
                actual_gmv = data.get('gmv', 0)
                tolerance = 0.01
                results.append(TestResult(
                    f"Template GMV: {template.coupon_name}",
                    abs(expected_gmv - actual_gmv) < tolerance,
                    expected=expected_gmv,
                    actual=actual_gmv
                ))
        
        return results
    
    def run_all_tests(self) -> Dict[str, list]:
        """Run all test stages."""
        all_results = {}
        
        if not self.authenticate():
            print("Failed to authenticate. Cannot run tests.")
            return all_results
        
        all_results['stage1'] = self.test_stage1_basic_statistics()
        all_results['stage2'] = self.test_stage2_core_analytics()
        all_results['stage3'] = self.test_stage3_trend_data()
        all_results['stage4'] = self.test_stage4_template_analytics()
        
        return all_results
    
    def print_summary(self, results: Dict[str, list]):
        """Print test summary."""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_passed = 0
        total_failed = 0
        
        for stage, stage_results in results.items():
            print(f"\n{stage.upper()}:")
            for result in stage_results:
                print(f"  {result}")
                if result.passed:
                    total_passed += 1
                else:
                    total_failed += 1
        
        print("\n" + "=" * 60)
        print(f"Total: {total_passed} passed, {total_failed} failed")
        print("=" * 60)
        
        return total_failed == 0


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Test merchant statistics APIs')
    parser.add_argument('--stage', type=int, choices=[1, 2, 3, 4], help='Test a specific stage')
    parser.add_argument('--all', action='store_true', help='Test all stages')
    parser.add_argument('--url', type=str, default=BASE_URL, help='Base URL for API')
    
    args = parser.parse_args()
    
    tester = StatisticsTester(base_url=args.url)
    
    if not tester.authenticate():
        print("Failed to authenticate. Make sure:")
        print("1. Test server is running (./run_test_server.sh)")
        print("2. Test data has been generated (python scripts/generate_test_data.py)")
        print("3. Merchant account exists (merchant@demo.com / demo123456)")
        sys.exit(1)
    
    if args.stage:
        results = {}
        if args.stage == 1:
            results['stage1'] = tester.test_stage1_basic_statistics()
        elif args.stage == 2:
            results['stage2'] = tester.test_stage2_core_analytics()
        elif args.stage == 3:
            results['stage3'] = tester.test_stage3_trend_data()
        elif args.stage == 4:
            results['stage4'] = tester.test_stage4_template_analytics()
    else:
        # Default: run all tests
        results = tester.run_all_tests()
    
    success = tester.print_summary(results)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

