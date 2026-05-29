"""Unit tests for api/services/analytics_service.py"""
import pytest
from datetime import timedelta, date


@pytest.mark.django_db
class TestAnalyticsService:
    def test_get_template_redemption_trend_empty(self):
        from api.services.analytics_service import get_template_redemption_trend
        result = get_template_redemption_trend(
            template_id=9999,
            start_date=date.today() - timedelta(days=7),
            end_date=date.today(),
        )
        assert result == []

    def test_get_template_view_trend_empty(self):
        from api.services.analytics_service import get_template_view_trend
        result = get_template_view_trend(
            template_id=9999,
            start_date=date.today() - timedelta(days=7),
            end_date=date.today(),
        )
        assert result == []

    def test_redemption_trend_returns_list(self):
        from api.services.analytics_service import get_template_redemption_trend
        result = get_template_redemption_trend(
            template_id=1,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert isinstance(result, list)

    def test_view_trend_returns_list(self):
        from api.services.analytics_service import get_template_view_trend
        result = get_template_view_trend(
            template_id=1,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        assert isinstance(result, list)

    def test_redemption_trend_same_start_end_date(self):
        from api.services.analytics_service import get_template_redemption_trend
        today = date.today()
        result = get_template_redemption_trend(
            template_id=9999,
            start_date=today,
            end_date=today,
        )
        assert result == []

    def test_view_trend_same_start_end_date(self):
        from api.services.analytics_service import get_template_view_trend
        today = date.today()
        result = get_template_view_trend(
            template_id=9999,
            start_date=today,
            end_date=today,
        )
        assert result == []
