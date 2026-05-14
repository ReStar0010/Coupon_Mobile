"""/api/profile/ — Phase 1 GET + PATCH on the consumer profile.

Covers:
  * auth required
  * GET returns FE-shape camelCase {id, email, phone, displayName, avatarUrl, phoneVerified}
  * PATCH updates displayName / avatarUrl
  * PATCH rejects phone changes with 409 + hint
  * PATCH with invalid avatarUrl returns 400
  * DELETE not allowed (405) — deletion lives at /api/account/delete/
  * StudentProfile auto-created if missing
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from api.models import StudentProfile


pytestmark = pytest.mark.django_db


@pytest.fixture
def consumer():
    u = User.objects.create_user(
        username="prof@example.com",
        email="prof@example.com",
        password="x",
        first_name="Pri",
    )
    return u


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


class TestProfileGet:
    def test_requires_auth(self):
        resp = APIClient().get("/api/profile/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_creates_studentprofile_on_first_read(self, client, consumer):
        assert not StudentProfile.objects.filter(user=consumer).exists()
        resp = client.get("/api/profile/")
        assert resp.status_code == 200
        assert StudentProfile.objects.filter(user=consumer).exists()

    def test_returns_camelcase_shape(self, client, consumer):
        resp = client.get("/api/profile/")
        body = resp.json()
        assert set(body.keys()) == {
            "id", "email", "phone", "displayName", "avatarUrl", "phoneVerified"
        }
        assert body["id"] == str(consumer.id)
        assert body["email"] == "prof@example.com"
        assert body["phone"] is None
        assert body["phoneVerified"] is False
        # Falls back to first_name when display_name is unset
        assert body["displayName"] == "Pri"
        assert body["avatarUrl"] is None

    def test_returns_studentprofile_phone_when_present(self, client, consumer):
        StudentProfile.objects.create(
            user=consumer,
            phone_number="0912345678",
            phone_verified=True,
        )
        resp = client.get("/api/profile/")
        body = resp.json()
        assert body["phone"] == "0912345678"
        assert body["phoneVerified"] is True


class TestProfilePatch:
    def test_updates_display_name(self, client, consumer):
        resp = client.patch("/api/profile/", {"displayName": "New Name"}, format="json")
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "New Name"
        sp = StudentProfile.objects.get(user=consumer)
        assert sp.display_name == "New Name"

    def test_updates_avatar_url(self, client, consumer):
        url = "https://cdn.example.com/avatar.png"
        resp = client.patch("/api/profile/", {"avatarUrl": url}, format="json")
        assert resp.status_code == 200
        assert resp.json()["avatarUrl"] == url

    def test_rejects_phone_change(self, client, consumer):
        resp = client.patch("/api/profile/", {"phone": "0987654321"}, format="json")
        assert resp.status_code == status.HTTP_409_CONFLICT
        body = resp.json()
        # Surfaces hint from the exception context
        assert "phone" in body.get("developer_message", "").lower() or \
            body.get("error_code") == "PHONE_CHANGE_REQUIRES_OTP"

    def test_rejects_invalid_avatar_url(self, client, consumer):
        resp = client.patch(
            "/api/profile/", {"avatarUrl": "not-a-url"}, format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_overlong_display_name(self, client, consumer):
        resp = client.patch(
            "/api/profile/", {"displayName": "x" * 81}, format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_blank_display_name_clears_to_null(self, client, consumer):
        sp = StudentProfile.objects.create(user=consumer, display_name="Old")
        resp = client.patch("/api/profile/", {"displayName": ""}, format="json")
        assert resp.status_code == 200
        sp.refresh_from_db()
        assert sp.display_name is None
        # GET falls back to first_name when display_name is null
        get_resp = client.get("/api/profile/")
        assert get_resp.json()["displayName"] == "Pri"

    def test_patch_with_no_fields_is_noop(self, client, consumer):
        resp = client.patch("/api/profile/", {}, format="json")
        assert resp.status_code == 200

    def test_partial_update_does_not_overwrite_other_fields(self, client, consumer):
        StudentProfile.objects.create(
            user=consumer,
            display_name="Keep Me",
            avatar_url="https://cdn.example.com/keep.png",
        )
        resp = client.patch(
            "/api/profile/", {"displayName": "Changed"}, format="json"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["displayName"] == "Changed"
        assert body["avatarUrl"] == "https://cdn.example.com/keep.png"


class TestProfileMethodNotAllowed:
    def test_delete_not_allowed(self, client):
        resp = client.delete("/api/profile/")
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_post_not_allowed(self, client):
        resp = client.post("/api/profile/", {}, format="json")
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
