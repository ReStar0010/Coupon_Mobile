"""
Test scenario configurations for merchant statistics testing.
Each scenario defines test data parameters for different testing stages.
"""
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List


@dataclass
class Stage1Config:
    """Stage 1: Basic Counting Metrics Configuration"""
    name: str = "stage1_basic"
    description: str = "Basic counting metrics test - simple data aggregation"
    
    # Template configuration
    num_active_templates: int = 3
    num_inactive_templates: int = 2
    num_store_templates: int = 2
    total_quantity_per_template: int = 20
    
    # View/click configuration
    clicks_per_template: int = 50  # Random template views
    
    # No redemptions in Stage 1 (keep it simple)


@dataclass
class Stage2Config:
    """Stage 2: EasyUse Template Analytics Configuration"""
    name: str = "stage2_easyuse"
    description: str = "EasyUse (store) template analytics test"
    
    # Template configuration
    num_store_templates: int = 2
    
    # Click/view configuration
    clicks_per_template: int = 100
    nearby_click_ratio: float = 0.6  # 60% nearby clicks
    
    # Conversion configuration
    conversion_rate: float = 0.15  # 15% conversion rate
    
    # Time distribution
    time_range_days: int = 30


@dataclass
class Stage3Config:
    """Stage 3: Exclusive Basic Metrics Configuration"""
    name: str = "stage3_exclusive_basic"
    description: str = "Exclusive template basic metrics test"
    
    # Template configuration
    num_exclusive_templates: int = 3
    coupons_per_template: int = 50
    
    # Click/view configuration
    clicks_per_template: int = 150
    nearby_click_ratio: float = 0.6
    
    # Redemption configuration
    redemption_rate: float = 0.4  # 40% redemption rate
    
    # Time distribution
    time_range_days: int = 30


@dataclass
class Stage4Config:
    """Stage 4: Exclusive Advanced Metrics Configuration"""
    name: str = "stage4_exclusive_advanced"
    description: str = "Exclusive template advanced metrics test"
    
    # Template configuration
    num_exclusive_templates: int = 2
    coupons_per_template: int = 100
    
    # Redemption configuration
    redemption_rate: float = 0.5  # 50% total redemption rate
    stranger_acquisition_ratio: float = 0.6  # 60% stranger redemptions
    sharing_rate: float = 0.3  # 30% of coupons get shared
    circulation_redemption_ratio: float = 0.7  # 70% of circulated coupons get redeemed
    
    # Click/view configuration
    clicks_per_template: int = 200
    nearby_click_ratio: float = 0.6
    
    # Time distribution
    time_range_days: int = 30


@dataclass
class Stage5Config:
    """Stage 5: Trends & Edge Cases Configuration"""
    name: str = "stage5_trends_edge"
    description: str = "Time trends and edge cases test"
    
    # Time range testing
    time_ranges: List[int] = field(default_factory=lambda: [3, 7, 30, 90])
    data_distribution: str = "uniform"  # uniform, front_loaded, back_loaded
    
    # Edge case scenarios
    edge_case_scenarios: List[str] = field(default_factory=lambda: [
        "empty_data",
        "high_redemption_rate",
        "low_conversion_rate",
        "all_stranger_acquisition",
        "no_circulation",
        "cross_time_range"
    ])
    
    # Edge case parameters
    high_redemption_rate: float = 0.95
    low_conversion_exposures: int = 1000
    low_conversion_redemptions: int = 2


def get_stage_config(stage: int) -> Optional[Any]:
    """Get configuration for a specific stage."""
    configs = {
        1: Stage1Config,
        2: Stage2Config,
        3: Stage3Config,
        4: Stage4Config,
        5: Stage5Config,
    }
    config_class = configs.get(stage)
    if config_class:
        return config_class()
    return None


def create_custom_config(stage: int, **kwargs) -> Optional[Any]:
    """Create a custom configuration by overriding default values."""
    base_config = get_stage_config(stage)
    if not base_config:
        return None
    
    # Create a new instance with overridden values
    config_dict = base_config.__dict__.copy()
    config_dict.update(kwargs)
    
    config_class = type(base_config)
    return config_class(**config_dict)


def load_config_from_dict(stage: int, config_dict: Dict[str, Any]) -> Optional[Any]:
    """Load configuration from a dictionary."""
    config_class = {
        1: Stage1Config,
        2: Stage2Config,
        3: Stage3Config,
        4: Stage4Config,
        5: Stage5Config,
    }.get(stage)
    
    if not config_class:
        return None
    
    # Filter out keys that don't exist in the config class
    valid_keys = {k: v for k, v in config_dict.items() if hasattr(config_class, k)}
    return config_class(**valid_keys)

