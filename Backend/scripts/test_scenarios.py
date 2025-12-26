"""
Test scenario configurations for merchant statistics testing.
Each scenario defines test data parameters and expected results.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class ScenarioConfig:
    """Configuration for a test scenario."""
    name: str
    description: str
    
    # Template configuration
    num_active_templates: int
    num_inactive_templates: int
    num_store_templates: int  # EasyUse templates (total_quantity=0)
    
    # Coupon generation
    num_coupons_per_template: int
    num_exclusive_coupons: int
    
    # Redemption configuration
    redemption_rate: float  # Percentage of coupons that get redeemed (0-1)
    stranger_redemption_ratio: float  # Percentage of redemptions by non-original owners (0-1)
    
    # Sharing configuration
    sharing_rate: float  # Percentage of coupons that get shared (0-1)
    avg_transfers_per_shared_coupon: float  # Average number of transfers for shared coupons
    
    # Click/view configuration
    clicks_per_template: int
    nearby_click_ratio: float  # Percentage of clicks within 500m (0-1)
    
    # Store configuration
    average_order_value: float
    
    # Expected results (for validation)
    expected_results: Dict[str, Any]


# Scenario 1: High Redemption Rate
SCENARIO_HIGH_REDEMPTION = ScenarioConfig(
    name="high_redemption",
    description="High redemption rate scenario (>80% redemption rate)",
    num_active_templates=3,
    num_inactive_templates=1,
    num_store_templates=1,
    num_coupons_per_template=20,
    num_exclusive_coupons=60,  # 3 templates * 20
    redemption_rate=0.85,  # 85% redemption rate
    stranger_redemption_ratio=0.3,  # 30% by strangers
    sharing_rate=0.2,  # 20% shared
    avg_transfers_per_shared_coupon=1.5,
    clicks_per_template=100,
    nearby_click_ratio=0.6,  # 60% nearby
    average_order_value=250.0,
    expected_results={
        "redemption_rate": (0.80, 0.90),  # Expected range
        "gmv": None,  # Will be calculated
        "stranger_acquisition_ratio": (0.25, 0.35),
    }
)

# Scenario 2: High Sharing Rate
SCENARIO_HIGH_SHARING = ScenarioConfig(
    name="high_sharing",
    description="High sharing rate scenario (high activation rate)",
    num_active_templates=2,
    num_inactive_templates=1,
    num_store_templates=1,
    num_coupons_per_template=15,
    num_exclusive_coupons=30,  # 2 templates * 15
    redemption_rate=0.5,  # 50% redemption rate
    stranger_redemption_ratio=0.7,  # 70% by strangers (high sharing leads to stranger redemptions)
    sharing_rate=0.6,  # 60% shared (high sharing)
    avg_transfers_per_shared_coupon=2.0,  # More transfers per shared coupon
    clicks_per_template=80,
    nearby_click_ratio=0.5,
    average_order_value=200.0,
    expected_results={
        "coupon_activation_rate": (0.50, 0.70),  # High activation due to sharing
        "stranger_acquisition_ratio": (0.65, 0.75),
    }
)

# Scenario 3: High Stranger Acquisition
SCENARIO_HIGH_STRANGER = ScenarioConfig(
    name="high_stranger",
    description="High stranger acquisition scenario (most redemptions by non-original owners)",
    num_active_templates=2,
    num_inactive_templates=0,
    num_store_templates=1,
    num_coupons_per_template=25,
    num_exclusive_coupons=50,  # 2 templates * 25
    redemption_rate=0.6,  # 60% redemption rate
    stranger_redemption_ratio=0.9,  # 90% by strangers
    sharing_rate=0.5,  # 50% shared
    avg_transfers_per_shared_coupon=2.5,
    clicks_per_template=120,
    nearby_click_ratio=0.4,
    average_order_value=300.0,
    expected_results={
        "stranger_acquisition_ratio": (0.85, 0.95),
        "coupon_activation_rate": (0.40, 0.60),
    }
)

# Scenario 4: Predictable Data (for manual verification)
SCENARIO_PREDICTABLE = ScenarioConfig(
    name="predictable",
    description="Predictable data scenario with fixed values for manual verification",
    num_active_templates=2,
    num_inactive_templates=1,
    num_store_templates=1,
    num_coupons_per_template=10,  # Fixed: 2 templates * 10 = 20 coupons
    num_exclusive_coupons=20,  # Fixed: exactly 20
    redemption_rate=0.5,  # Fixed: exactly 10 redemptions
    stranger_redemption_ratio=0.4,  # Fixed: 4 by strangers, 6 by original owners
    sharing_rate=0.3,  # Fixed: 6 coupons shared
    avg_transfers_per_shared_coupon=1.0,  # Fixed: exactly 1 transfer per shared
    clicks_per_template=50,  # Fixed: 2 templates * 50 = 100 clicks
    nearby_click_ratio=0.5,  # Fixed: 50 nearby, 50 far
    average_order_value=250.0,  # Fixed: 250 TWD
    expected_results={
        "total_redemptions": 10,  # Exact: 20 * 0.5 = 10
        "total_views": 100,  # Exact: 2 * 50 = 100
        "gmv": 2500.0,  # Exact: 10 * 250 = 2500
        "stranger_acquisition_ratio": 0.4,  # Exact: 4/10 = 0.4
        "overall_conversion_rate": 0.1,  # Exact: 10/100 = 0.1
        "redemption_rate": 0.5,  # Exact: 10/20 = 0.5
    }
)

# Scenario 5: Time Distribution (for trend testing)
SCENARIO_TIME_DISTRIBUTION = ScenarioConfig(
    name="time_distribution",
    description="Data distributed across multiple days for trend testing",
    num_active_templates=2,
    num_inactive_templates=0,
    num_store_templates=1,
    num_coupons_per_template=30,
    num_exclusive_coupons=60,  # 2 templates * 30
    redemption_rate=0.6,  # 60% redemption rate
    stranger_redemption_ratio=0.5,  # 50% by strangers
    sharing_rate=0.4,  # 40% shared
    avg_transfers_per_shared_coupon=1.5,
    clicks_per_template=150,  # More clicks for trend analysis
    nearby_click_ratio=0.6,
    average_order_value=250.0,
    expected_results={
        "days_with_data": 30,  # Data spread across 30 days
    }
)

# Map of scenario names to configurations
SCENARIOS = {
    "high_redemption": SCENARIO_HIGH_REDEMPTION,
    "high_sharing": SCENARIO_HIGH_SHARING,
    "high_stranger": SCENARIO_HIGH_STRANGER,
    "predictable": SCENARIO_PREDICTABLE,
    "time_distribution": SCENARIO_TIME_DISTRIBUTION,
}


def get_scenario(name: str) -> Optional[ScenarioConfig]:
    """Get a scenario configuration by name."""
    return SCENARIOS.get(name)


def list_scenarios() -> list:
    """List all available scenario names."""
    return list(SCENARIOS.keys())

