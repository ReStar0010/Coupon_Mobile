"""POST /api/coupon/receive/ — Phase 5 scan-to-receive flow.

Thin wrapper over claim_coupon_via_qr. Covers:
  * auth required
  * missing qrToken → 400
  * valid qrToken → creates exclusive Coupon owned by request.user
  * idempotency: same idempotencyKey returns the same coupon
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Coupon,
    CouponTemplate,
    QRCodeSession,
    Store,
)


pytestmark = pytest.mark.django_db


@pytest.fixture
def consumer():
    return User.objects.create_user(username="receiver", password="x")


@pytest.fixture
def client(consumer):
    c = APIClient()
    c.force_authenticate(user=consumer)
    return c


@pytest.fixture
def merchant():
    grp, _ = Group.objects.get_or_create(name='Merchant')
    u = User.objects.create_user(username="m_recv", password="x")
    u.groups.add(grp)
    return u


@pytest.fixture
def store(merchant):
    return Store.objects.create(owner=merchant, name="阿明早餐店", address="忠孝東路")


@pytest.fixture
def template(store):
    return CouponTemplate.objects.create(
        store=store,
        coupon_name="$25 折抵",
        coupon_detail="現金折抵 $25",
        total_quantity=5,
        remaining_quantity=5,
        start_date=timezone.now() - timedelta(days=1),
        expiry_date=timezone.now() + timedelta(days=30),
        estimated_savings=25,
    )


@pytest.fixture
def qr_session(template, merchant):
    return QRCodeSession.objects.create(
        template=template,
        merchant=merchant,
        session_token="receive-tok-1",
        is_active=True,
    )


def test_requires_auth():
    resp = APIClient().post("/api/coupon/receive/", {}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_missing_token_400(client):
    resp = client.post("/api/coupon/receive/", {}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error_code"] == "QR_TOKEN_REQUIRED"


def test_blank_token_400(client):
    resp = client.post("/api/coupon/receive/", {"qrToken": "   "}, format="json")
    assert resp.status_code == 400


def test_valid_token_creates_coupon(client, consumer, qr_session, template):
    assert not Coupon.objects.filter(current_holder=consumer).exists()
    resp = client.post(
        "/api/coupon/receive/",
        {"qrToken": qr_session.session_token},
        format="json",
    )
    # claim_coupon_via_qr returns the default 200 (no explicit status set on
    # success), but DRF wraps successful Response objects without overriding.
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body["coupon_name"] == "$25 折抵"
    assert body["acquisition_method"] == "qr_claim"
    # Coupon owned by the consumer
    coupon = Coupon.objects.get(id=body["coupon_id"])
    assert coupon.current_holder == consumer
    assert coupon.coupon_type == 'exclusive'
    # Template remaining quantity decremented
    template.refresh_from_db()
    assert template.remaining_quantity == 4


def test_idempotency_returns_same_coupon(client, consumer, qr_session, template):
    r1 = client.post(
        "/api/coupon/receive/",
        {"qrToken": qr_session.session_token, "idempotencyKey": "abc-123"},
        format="json",
    )
    coupon_id = r1.json()["coupon_id"]
    r2 = client.post(
        "/api/coupon/receive/",
        {"qrToken": qr_session.session_token, "idempotencyKey": "abc-123"},
        format="json",
    )
    assert r2.status_code in (200, 201)
    assert r2.json()["coupon_id"] == coupon_id
    # Only one coupon row created
    assert Coupon.objects.filter(template=template, current_holder=consumer).count() == 1


def test_inactive_session_4xx(client, consumer, qr_session):
    qr_session.is_active = False
    qr_session.save()
    resp = client.post(
        "/api/coupon/receive/",
        {"qrToken": qr_session.session_token},
        format="json",
    )
    assert resp.status_code in (400, 404)
