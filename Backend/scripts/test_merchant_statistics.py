#!/usr/bin/env python
"""
Automated test script for merchant statistics API.
Tests the correctness of statistics calculations across 5 different stages.

Usage:
    python test_merchant_statistics.py [--stage STAGE] [--all] [--config CONFIG_FILE]
    
    --stage: Test a specific stage (1, 2, 3, 4, 5)
    --all: Test all stages
    --config: Path to JSON config file for custom parameters
"""
import os
import sys
import django
import argparse
import requests
import json
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from datetime import timedelta
from django.utils import timezone

# Add the Backend directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module to test_settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.test_settings')

# Setup Django
django.setup()

from django.contrib.auth.models import User
from api.models import (
    Store, Coupon, CouponTemplate, CouponRedemption, 
    Log, CouponShareRequest
)

from scripts.merchant_test_scenarios import (
    get_stage_config, create_custom_config, load_config_from_dict
)
from scripts.generate_merchant_test_data import (
    create_tags, create_merchant, create_store, create_students,
    generate_stage1_data, generate_stage2_data, generate_stage3_data,
    generate_stage4_data, generate_stage5_data
)
from scripts.verify_merchant_statistics import StatisticsVerifier

# Test configuration
BASE_URL = "http://localhost:8001"
MERCHANT_EMAIL = "merchant@demo.com"
MERCHANT_PASSWORD = "demo123456"


class TestResult:
    """Represents a test result."""
    def __init__(self, name: str, passed: bool, message: str = "", expected: Any = None, actual: Any = None, difference: float = 0.0):
        self.name = name
        self.passed = passed
        self.message = message
        self.expected = expected
        self.actual = actual
        self.difference = difference
    
    def __str__(self):
        status = "✓ PASS" if self.passed else "✗ FAIL"
        msg = f"{status}: {self.name}"
        if self.message:
            msg += f" - {self.message}"
        if self.expected is not None and self.actual is not None:
            # Check if both expected and actual are numeric (int or float)
            if isinstance(self.expected, (int, float)) and isinstance(self.actual, (int, float)):
                msg += f" (Expected: {self.expected:.6f}, Actual: {self.actual:.6f}, Diff: {self.difference:.6f})"
            else:
                msg += f" (Expected: {self.expected}, Actual: {self.actual})"
        return msg
    
    def to_dict(self):
        return {
            'name': self.name,
            'passed': self.passed,
            'message': self.message,
            'expected': self.expected,
            'actual': self.actual,
            'difference': self.difference
        }


class StatisticsTester:
    """Test suite for merchant statistics APIs."""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.token = None
        self.results = []
        self.verifier = StatisticsVerifier(base_url=base_url)
    
    def authenticate(self) -> bool:
        """Authenticate as merchant and get token."""
        return self.verifier.authenticate()
    
    def _make_request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Optional[Dict]:
        """Make an authenticated API request."""
        return self.verifier._make_request(endpoint, data)
    
    def test_stage1_basic_statistics(self, store: Store) -> List[TestResult]:
        """Stage 1: Test basic statistics API."""
        print("\n" + "=" * 60)
        print("STAGE 1: Basic Statistics Test")
        print("=" * 60)
        
        results = []
        data = self._make_request("/api/merchant/statistics/")
        
        if not data:
            results.append(TestResult(
                "Basic Statistics API", False,
                "Failed to get response"
            ))
            return results
        
        # Get actual database counts for verification
        if not store:
            results.append(TestResult(
                "Store Exists", False,
                "Merchant store not found"
            ))
            return results
        
        # Verify each metric
        verification_results = self.verifier.verify_basic_statistics(store)
        
        for metric, (api_val, db_val, passed) in verification_results.items():
            diff = abs(api_val - db_val) if isinstance(api_val, (int, float)) and isinstance(db_val, (int, float)) else 0
            results.append(TestResult(
                metric.replace('_', ' ').title(),
                passed,
                expected=db_val,
                actual=api_val,
                difference=diff
            ))
        
        return results
    
    def test_stage2_easyuse_analytics(self, store: Store) -> List[TestResult]:
        """Stage 2: Test EasyUse template analytics."""
        print("\n" + "=" * 60)
        print("STAGE 2: EasyUse Template Analytics Test")
        print("=" * 60)
        
        results = []
        
        # Get all EasyUse templates (total_quantity == 0)
        templates = CouponTemplate.objects.filter(store=store, total_quantity=0)
        
        if templates.count() == 0:
            results.append(TestResult(
                "EasyUse Templates Exist", False,
                "No EasyUse templates found"
            ))
            return results
        
        # Test each template
        for template in templates:
            print(f"\nTesting Template: {template.coupon_name} (ID: {template.id})")
            verification_results = self.verifier.verify_store_template_analytics(template, days=30)
            
            for metric, (api_val, db_val, passed, diff) in verification_results.items():
                results.append(TestResult(
                    f"{template.coupon_name} - {metric.replace('_', ' ').title()}",
                    passed,
                    expected=db_val,
                    actual=api_val,
                    difference=diff
                ))
        
        return results
    
    def test_stage3_exclusive_basic(self, store: Store) -> List[TestResult]:
        """Stage 3: Test Exclusive template basic metrics."""
        print("\n" + "=" * 60)
        print("STAGE 3: Exclusive Basic Metrics Test")
        print("=" * 60)
        
        results = []
        
        # Get all Exclusive templates (total_quantity > 0)
        templates = CouponTemplate.objects.filter(store=store, total_quantity__gt=0)
        
        if templates.count() == 0:
            results.append(TestResult(
                "Exclusive Templates Exist", False,
                "No Exclusive templates found"
            ))
            return results
        
        # Test each template
        for template in templates[:3]:  # Test first 3 templates
            print(f"\nTesting Template: {template.coupon_name} (ID: {template.id})")
            verification_results = self.verifier.verify_exclusive_template_analytics(template, days=30)
            
            # Filter for basic metrics only
            basic_metrics = ['exposure_count', 'conversion_rate', 'redemption_rate']
            for metric in basic_metrics:
                if metric in verification_results:
                    api_val, db_val, passed, diff = verification_results[metric]
                    results.append(TestResult(
                        f"{template.coupon_name} - {metric.replace('_', ' ').title()}",
                        passed,
                        expected=db_val,
                        actual=api_val,
                        difference=diff
                    ))
        
        return results
    
    def test_stage4_exclusive_advanced(self, store: Store) -> List[TestResult]:
        """Stage 4: Test Exclusive template advanced metrics."""
        print("\n" + "=" * 60)
        print("STAGE 4: Exclusive Advanced Metrics Test")
        print("=" * 60)
        
        results = []
        
        # Get all Exclusive templates
        templates = CouponTemplate.objects.filter(store=store, total_quantity__gt=0)
        
        if templates.count() == 0:
            results.append(TestResult(
                "Exclusive Templates Exist", False,
                "No Exclusive templates found"
            ))
            return results
        
        # Test each template
        for template in templates[:2]:  # Test first 2 templates
            print(f"\nTesting Template: {template.coupon_name} (ID: {template.id})")
            verification_results = self.verifier.verify_exclusive_template_analytics(template, days=30)
            
            # Filter for advanced metrics only
            advanced_metrics = ['retention_rate', 'stranger_acquisition_rate', 
                              'circulation_rate', 'circulation_redemption_rate']
            for metric in advanced_metrics:
                if metric in verification_results:
                    api_val, db_val, passed, diff = verification_results[metric]
                    results.append(TestResult(
                        f"{template.coupon_name} - {metric.replace('_', ' ').title()}",
                        passed,
                        expected=db_val,
                        actual=api_val,
                        difference=diff
                    ))
        
        return results
    
    def test_stage5_trends_edge_cases(self, store: Store) -> List[TestResult]:
        """Stage 5: Test time trends and edge cases."""
        print("\n" + "=" * 60)
        print("STAGE 5: Trends & Edge Cases Test")
        print("=" * 60)
        
        results = []
        
        # Test different time ranges
        time_ranges = [3, 7, 30, 90]
        templates = CouponTemplate.objects.filter(store=store)
        
        if templates.count() == 0:
            results.append(TestResult(
                "Templates Exist", False,
                "No templates found"
            ))
            return results
        
        # Test time range filtering
        for days in time_ranges:
            print(f"\nTesting time range: {days} days")
            for template in templates[:2]:  # Test first 2 templates
                data = self._make_request(
                    f"/api/merchant/coupon-templates/{template.id}/analytics/",
                    data={"days": days}
                )
                
                if data:
                    trends = data.get('trends', {})
                    for metric_name, trend_data in trends.items():
                        daily_data = trend_data.get('daily_data', [])
                        expected_length = days + 1
                        actual_length = len(daily_data)
                        
                        results.append(TestResult(
                            f"{template.coupon_name} - {days}d - {metric_name} daily_data length",
                            actual_length == expected_length,
                            expected=expected_length,
                            actual=actual_length
                        ))
        
        # Test edge cases
        # 1. Empty data template
        empty_template = CouponTemplate.objects.filter(
            store=store,
            coupon_name__icontains='Empty'
        ).first()
        
        if empty_template:
            print(f"\nTesting empty data template: {empty_template.coupon_name}")
            data = self._make_request(
                f"/api/merchant/coupon-templates/{empty_template.id}/analytics/",
                data={"days": 30}
            )
            
            if data:
                exposure_count = data.get('exposure_count', -1)
                results.append(TestResult(
                    "Empty Data - Exposure Count",
                    exposure_count == 0,
                    expected=0,
                    actual=exposure_count
                ))
                
                if empty_template.total_quantity > 0:
                    redemption_rate = data.get('redemption_rate', -1)
                    results.append(TestResult(
                        "Empty Data - Redemption Rate",
                        redemption_rate == 0,
                        expected=0.0,
                        actual=redemption_rate
                    ))
        
        # 2. High redemption rate template
        high_template = CouponTemplate.objects.filter(
            store=store,
            coupon_name__icontains='High_Redemption'
        ).first()
        
        if high_template:
            print(f"\nTesting high redemption template: {high_template.coupon_name}")
            data = self._make_request(
                f"/api/merchant/coupon-templates/{high_template.id}/analytics/",
                data={"days": 30}
            )
            
            if data and high_template.total_quantity > 0:
                redemption_rate = data.get('redemption_rate', 0)
                expected_min = 0.90  # Should be around 95%
                
                results.append(TestResult(
                    "High Redemption Rate",
                    redemption_rate >= expected_min,
                    expected=f">={expected_min}",
                    actual=redemption_rate
                ))
        
        # 3. Low conversion rate template
        low_template = CouponTemplate.objects.filter(
            store=store,
            coupon_name__icontains='Low_Conversion'
        ).first()
        
        if low_template:
            print(f"\nTesting low conversion template: {low_template.coupon_name}")
            data = self._make_request(
                f"/api/merchant/coupon-templates/{low_template.id}/analytics/",
                data={"days": 30}
            )
            
            if data:
                exposure_count = data.get('exposure_count', 0)
                conversion_rate = data.get('conversion_rate', 0)
                
                results.append(TestResult(
                    "Low Conversion - High Exposure",
                    exposure_count >= 500,  # Should have many exposures
                    expected=">=500",
                    actual=exposure_count
                ))
                
                results.append(TestResult(
                    "Low Conversion - Low Rate",
                    conversion_rate <= 0.01,  # Should be very low
                    expected="<=0.01",
                    actual=conversion_rate
                ))
        
        return results
    
    def run_stage_test(self, stage: int, store: Store) -> List[TestResult]:
        """Run tests for a specific stage."""
        if stage == 1:
            return self.test_stage1_basic_statistics(store)
        elif stage == 2:
            return self.test_stage2_easyuse_analytics(store)
        elif stage == 3:
            return self.test_stage3_exclusive_basic(store)
        elif stage == 4:
            return self.test_stage4_exclusive_advanced(store)
        elif stage == 5:
            return self.test_stage5_trends_edge_cases(store)
        else:
            return []
    
    def print_summary(self, results: Dict[int, List[TestResult]]):
        """Print test summary."""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_passed = 0
        total_failed = 0
        
        for stage, stage_results in results.items():
            print(f"\nSTAGE {stage}:")
            stage_passed = sum(1 for r in stage_results if r.passed)
            stage_failed = len(stage_results) - stage_passed
            
            for result in stage_results:
                print(f"  {result}")
                if result.passed:
                    total_passed += 1
                else:
                    total_failed += 1
            
            print(f"  Summary: {stage_passed}/{len(stage_results)} passed")
        
        print("\n" + "=" * 60)
        print(f"Total: {total_passed} passed, {total_failed} failed")
        print("=" * 60)
        
        return total_failed == 0
    
    def save_report(self, results: Dict[int, List[TestResult]], filename: str = "test_report.json"):
        """Save test results to JSON file."""
        report = {
            'stages': {}
        }
        
        for stage, stage_results in results.items():
            report['stages'][stage] = {
                'total': len(stage_results),
                'passed': sum(1 for r in stage_results if r.passed),
                'failed': sum(1 for r in stage_results if not r.passed),
                'results': [r.to_dict() for r in stage_results]
            }
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\nTest report saved to: {filename}")


def generate_test_data_for_stage(stage: int, config=None):
    """Generate test data for a specific stage."""
    print(f"\n{'=' * 60}")
    print(f"GENERATING TEST DATA FOR STAGE {stage}")
    print('=' * 60)
    
    # Import here to avoid circular imports
    from scripts.generate_merchant_test_data import (
        create_tags, create_merchant, create_store, create_students,
        generate_stage1_data, generate_stage2_data, generate_stage3_data,
        generate_stage4_data, generate_stage5_data
    )
    
    # Create base data
    tags = create_tags()
    merchant_user, merchant_profile = create_merchant()
    store = create_store(merchant_user, 250.00)
    students = create_students(count=30)
    
    # Generate stage-specific data
    if stage == 1:
        result = generate_stage1_data(store, tags, students, config)
    elif stage == 2:
        result = generate_stage2_data(store, tags, students, config)
    elif stage == 3:
        result = generate_stage3_data(store, tags, students, config)
    elif stage == 4:
        result = generate_stage4_data(store, tags, students, config)
    elif stage == 5:
        result = generate_stage5_data(store, tags, students, config)
    else:
        print(f"Error: Unknown stage {stage}")
        return None
    
    print(f"✓ Generated {len(result['templates'])} templates")
    print(f"✓ Generated {len(result['coupons'])} coupons")
    print(f"✓ Created {result['logs']} log entries")
    print(f"✓ Created {result['redemptions']} redemptions")
    
    return store


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Test merchant statistics APIs')
    parser.add_argument('--stage', type=int, choices=[1, 2, 3, 4, 5], help='Test a specific stage')
    parser.add_argument('--all', action='store_true', help='Test all stages')
    parser.add_argument('--url', type=str, default=BASE_URL, help='Base URL for API')
    parser.add_argument('--config', type=str, help='Path to JSON config file')
    parser.add_argument('--no-generate', action='store_true', help='Skip data generation (use existing data)')
    parser.add_argument('--report', type=str, help='Save test report to file')
    
    args = parser.parse_args()
    
    tester = StatisticsTester(base_url=args.url)
    
    if not tester.authenticate():
        print("Failed to authenticate. Make sure:")
        print("1. Test server is running (./run_test_server.sh)")
        print("2. Test data has been generated")
        print("3. Merchant account exists (merchant@demo.com / demo123456)")
        sys.exit(1)
    
    # Determine which stages to test
    if args.all:
        stages_to_test = [1, 2, 3, 4, 5]
    elif args.stage:
        stages_to_test = [args.stage]
    else:
        stages_to_test = [1, 2, 3, 4, 5]  # Default: all stages
    
    # Load configuration if provided
    configs = {}
    if args.config:
        with open(args.config, 'r') as f:
            config_dict = json.load(f)
        for stage in stages_to_test:
            configs[stage] = load_config_from_dict(stage, config_dict.get(f'stage{stage}', {}))
    else:
        for stage in stages_to_test:
            configs[stage] = get_stage_config(stage)
    
    # Generate test data if needed
    if not args.no_generate:
        for stage in stages_to_test:
            config = configs.get(stage)
            if config:
                generate_test_data_for_stage(stage, config)
    
    # Get store
    store = Store.objects.filter(owner__email=MERCHANT_EMAIL).first()
    if not store:
        print("Error: Store not found for merchant")
        sys.exit(1)
    
    # Run tests
    all_results = {}
    for stage in stages_to_test:
        print(f"\n{'=' * 60}")
        print(f"RUNNING STAGE {stage} TESTS")
        print('=' * 60)
        stage_results = tester.run_stage_test(stage, store)
        all_results[stage] = stage_results
    
    # Print summary
    success = tester.print_summary(all_results)
    
    # Save report if requested
    if args.report:
        tester.save_report(all_results, args.report)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

