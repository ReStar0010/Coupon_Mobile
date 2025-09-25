"""
Contract Tests for Coupon_Mobile API

These tests validate API contracts defined in api-spec.yaml.
Tests should FAIL initially (no implementation) and PASS after implementation.
"""

import pytest
import requests
import json
from jsonschema import validate
from datetime import datetime, timedelta


class TestAuthenticationContracts:
    """Test authentication endpoint contracts"""
    
    base_url = "http://localhost:8000/api"
    
    def test_register_endpoint_contract(self):
        """Test /auth/register/ endpoint contract"""
        # This test should FAIL initially - no implementation exists
        
        # Valid registration payload
        payload = {
            "email": "test@example.com",
            "password": "securepassword123",
            "password_confirm": "securepassword123",
            "user_type": "student"
        }
        
        response = requests.post(f"{self.base_url}/auth/register/", json=payload)
        
        # Expected: 201 Created with JWT tokens
        assert response.status_code == 201
        
        data = response.json()
        assert "user" in data
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["email"] == payload["email"]
        
        # Validate response schema
        expected_schema = {
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "email": {"type": "string", "format": "email"},
                        "is_active": {"type": "boolean"}
                    },
                    "required": ["id", "email", "is_active"]
                },
                "access": {"type": "string"},
                "refresh": {"type": "string"}
            },
            "required": ["user", "access", "refresh"]
        }
        validate(instance=data, schema=expected_schema)
    
    def test_login_endpoint_contract(self):
        """Test /auth/login/ endpoint contract"""
        payload = {
            "email": "test@example.com",
            "password": "securepassword123"
        }
        
        response = requests.post(f"{self.base_url}/auth/login/", json=payload)
        
        # Expected: 200 OK with JWT tokens
        assert response.status_code == 200
        
        data = response.json()
        assert "access" in data
        assert "refresh" in data
        assert "user" in data
        
    def test_refresh_token_contract(self):
        """Test /auth/refresh/ endpoint contract"""
        # Assumes we have a valid refresh token
        payload = {"refresh": "valid_refresh_token_here"}
        
        response = requests.post(f"{self.base_url}/auth/refresh/", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "access" in data


class TestCouponContracts:
    """Test coupon-related endpoint contracts"""
    
    base_url = "http://localhost:8000/api"
    headers = {"Authorization": "Bearer valid_jwt_token"}
    
    def test_get_store_coupons_contract(self):
        """Test /coupons/store/ endpoint contract"""
        response = requests.get(f"{self.base_url}/coupons/store/")
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Validate coupon schema if coupons exist
        if data:
            coupon_schema = {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "coupon_name": {"type": "string"},
                    "coupon_detail": {"type": "string"},
                    "coupon_type": {"type": "string", "enum": ["store", "exclusive"]},
                    "estimated_savings": {"type": ["number", "null"]},
                    "start_date": {"type": "string"},
                    "expiry_date": {"type": "string"},
                    "store": {"type": "object"},
                    "tags": {"type": "array"}
                },
                "required": ["id", "coupon_name", "coupon_detail", "coupon_type"]
            }
            validate(instance=data[0], schema=coupon_schema)
    
    def test_get_my_coupons_contract(self):
        """Test /coupons/my/ endpoint contract"""
        response = requests.get(
            f"{self.base_url}/coupons/my/", 
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_redeem_coupon_contract(self):
        """Test /coupons/{id}/redeem/ endpoint contract"""
        coupon_id = 1
        payload = {
            "redeem_code": "ABC123",
            "savings_amount": 15.50
        }
        
        response = requests.post(
            f"{self.base_url}/coupons/{coupon_id}/redeem/",
            json=payload,
            headers=self.headers
        )
        
        # Could be 200 (success) or 400 (validation error)
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "coupon" in data
            assert "user" in data
            assert "redeemed_at" in data


class TestDailyDrawContracts:
    """Test daily draw endpoint contracts"""
    
    base_url = "http://localhost:8000/api"
    headers = {"Authorization": "Bearer valid_jwt_token"}
    
    def test_get_draw_templates_contract(self):
        """Test /daily-draw/templates/ endpoint contract"""
        response = requests.get(
            f"{self.base_url}/daily-draw/templates/",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            template_schema = {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "coupon_name": {"type": "string"},
                    "total_quantity": {"type": "integer"},
                    "remaining_quantity": {"type": "integer"},
                    "draw_probability": {"type": "number"},
                    "is_active": {"type": "boolean"},
                    "start_date": {"type": "string"},
                    "expiry_date": {"type": "string"}
                },
                "required": ["id", "coupon_name", "remaining_quantity", "is_active"]
            }
            validate(instance=data[0], schema=template_schema)
    
    def test_participate_draw_contract(self):
        """Test /daily-draw/{template_id}/draw/ endpoint contract"""
        template_id = 1
        
        response = requests.post(
            f"{self.base_url}/daily-draw/{template_id}/draw/",
            headers=self.headers
        )
        
        # Could be 200 (success) or 400 (already drawn/inactive)
        assert response.status_code in [200, 400]
        
        data = response.json()
        
        if response.status_code == 200:
            # Success response schema
            assert "success" in data
            assert "message" in data
            assert isinstance(data["success"], bool)
            
            if data["success"]:
                assert "coupon" in data
                assert data["coupon"]["coupon_type"] == "exclusive"


class TestSharingContracts:
    """Test coupon sharing endpoint contracts"""
    
    base_url = "http://localhost:8000/api"
    headers = {"Authorization": "Bearer valid_jwt_token"}
    
    def test_create_share_request_contract(self):
        """Test /coupons/{id}/share/ endpoint contract"""
        coupon_id = 1
        payload = {"to_user_email": "friend@example.com"}
        
        response = requests.post(
            f"{self.base_url}/coupons/{coupon_id}/share/",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code in [201, 400]
        
        if response.status_code == 201:
            data = response.json()
            assert "id" in data
            assert "token" in data
            assert "status" in data
            assert data["status"] == "pending"
    
    def test_get_share_requests_contract(self):
        """Test /share-requests/ endpoint contract"""
        response = requests.get(
            f"{self.base_url}/share-requests/",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sent" in data
        assert "received" in data
        assert isinstance(data["sent"], list)
        assert isinstance(data["received"], list)
    
    def test_respond_share_request_contract(self):
        """Test /share-requests/{token}/respond/ endpoint contract"""
        token = "valid_share_token"
        payload = {"action": "accept"}
        
        response = requests.post(
            f"{self.base_url}/share-requests/{token}/respond/",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code in [200, 400, 404]


class TestStatisticsContracts:
    """Test user statistics endpoint contracts"""
    
    base_url = "http://localhost:8000/api"
    headers = {"Authorization": "Bearer valid_jwt_token"}
    
    def test_get_statistics_contract(self):
        """Test /statistics/ endpoint contract"""
        response = requests.get(
            f"{self.base_url}/statistics/",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        expected_fields = [
            "coupons_used_count",
            "total_savings",
            "monthly_savings",
            "savings_goal",
            "completed_goals"
        ]
        
        for field in expected_fields:
            assert field in data
        
        # Validate numeric fields
        assert isinstance(data["coupons_used_count"], int)
        assert isinstance(data["total_savings"], (int, float))
        assert isinstance(data["monthly_savings"], (int, float))
        assert isinstance(data["completed_goals"], list)
    
    def test_get_redemption_history_contract(self):
        """Test /statistics/redemption-history/ endpoint contract"""
        response = requests.get(
            f"{self.base_url}/statistics/redemption-history/",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Paginated response schema
        assert "count" in data
        assert "results" in data
        assert isinstance(data["results"], list)
        
        if data["results"]:
            redemption = data["results"][0]
            assert "id" in redemption
            assert "coupon" in redemption
            assert "redeemed_at" in redemption


class TestStoreContracts:
    """Test store-related endpoint contracts"""
    
    base_url = "http://localhost:8000/api"
    headers = {"Authorization": "Bearer valid_jwt_token"}
    
    def test_list_stores_contract(self):
        """Test /stores/ endpoint contract"""
        response = requests.get(f"{self.base_url}/stores/")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            store_schema = {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "address": {"type": "string"},
                    "owner": {"type": "integer"}
                },
                "required": ["id", "name", "lat", "lng", "address"]
            }
            validate(instance=data[0], schema=store_schema)
    
    def test_create_store_contract(self):
        """Test POST /stores/ endpoint contract (merchants only)"""
        payload = {
            "name": "Test Store",
            "lat": 25.0330,
            "lng": 121.5654,
            "address": "123 Test Street, Taipei",
            "business_hours": "9:00-18:00"
        }
        
        response = requests.post(
            f"{self.base_url}/stores/",
            json=payload,
            headers=self.headers
        )
        
        # Could be 201 (created), 403 (not merchant), or 400 (validation)
        assert response.status_code in [201, 400, 403]
        
        if response.status_code == 201:
            data = response.json()
            assert data["name"] == payload["name"]
            assert data["lat"] == payload["lat"]
            assert data["lng"] == payload["lng"]


class TestErrorContracts:
    """Test error response contracts"""
    
    base_url = "http://localhost:8000/api"
    
    def test_401_unauthorized_contract(self):
        """Test 401 error response format"""
        response = requests.get(f"{self.base_url}/coupons/my/")
        
        assert response.status_code == 401
        data = response.json()
        
        # Should have error information
        assert "detail" in data or "error" in data
    
    def test_404_not_found_contract(self):
        """Test 404 error response format"""
        response = requests.get(f"{self.base_url}/coupons/99999/")
        
        assert response.status_code == 404
        data = response.json()
        
        assert "detail" in data or "error" in data
    
    def test_400_validation_error_contract(self):
        """Test 400 validation error response format"""
        payload = {"invalid": "data"}
        
        response = requests.post(f"{self.base_url}/auth/register/", json=payload)
        
        assert response.status_code == 400
        data = response.json()
        
        # Should contain validation error details
        assert isinstance(data, dict)


if __name__ == "__main__":
    """
    Run contract tests with:
    pytest contracts/test_api_contracts.py -v
    
    These tests validate that API endpoints match the OpenAPI specification.
    Initially, all tests should FAIL because no implementation exists.
    After implementation, tests should PASS.
    """
    pytest.main([__file__, "-v"])