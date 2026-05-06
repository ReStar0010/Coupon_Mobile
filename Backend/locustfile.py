"""
CouBox Backend — Locust load test scenarios.

Setup (one-time):
    cd Backend
    python manage.py seed_load_test --stage 1   # seeds ~200 users, 1 merchant
    # Creates load_tests/config/test_users.json and load_tests/config/stores.json

Run:
    locust -f locustfile.py --host=http://localhost:8000
    # Open http://localhost:8089 for the Locust web UI
    # Or headless:
    #   locust -f locustfile.py --host=http://localhost:8000 \\
    #     --users 50 --spawn-rate 5 --run-time 60s --headless

Reset between runs:
    python manage.py reset_load_test
"""

import json
import os
import random
import time
from pathlib import Path

from locust import HttpUser, task, between, tag, events
from locust.exception import RescheduleTask

# ---------------------------------------------------------------------------
# Config paths — seed command writes to load_tests/config/ (project root)
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_CONFIG_DIR = _PROJECT_ROOT / "load_tests" / "config"

_USERS_FILE = _CONFIG_DIR / "test_users.json"
_STORES_FILE = _CONFIG_DIR / "stores.json"

# Runtime data loaded once at Locust startup
_test_data: dict = {}


@events.init.add_listener
def load_test_data(environment, **kwargs):
    """Load seeded credentials from test_users.json at Locust startup."""
    global _test_data

    if not _USERS_FILE.exists():
        environment.runner.quit()
        raise FileNotFoundError(
            f"test_users.json not found at {_USERS_FILE}. "
            "Run: python manage.py seed_load_test --stage 1"
        )

    with open(_USERS_FILE, encoding="utf-8") as f:
        raw_users = json.load(f)

    stores: list[dict] = []
    if _STORES_FILE.exists():
        with open(_STORES_FILE, encoding="utf-8") as f:
            stores = json.load(f)

    # seed_load_test writes a flat list of {email, password} dicts for students
    # and creates merchant users as loadtest_merchant_N@loadtest.local
    students = [u for u in raw_users if isinstance(u, dict) and "email" in u]

    # Build merchant credentials from the stores list (one merchant per store)
    merchants = []
    for idx in range(len(stores)):
        merchants.append(
            {
                "email": f"loadtest_merchant_{idx + 1}@loadtest.local",
                "password": "loadtest123",
            }
        )

    if not students:
        environment.runner.quit()
        raise ValueError(
            "test_users.json contains no student entries. "
            "Run: python manage.py seed_load_test --stage 1"
        )

    _test_data["students"] = students
    _test_data["merchants"] = merchants if merchants else [{"email": "loadtest_merchant_1@loadtest.local", "password": "loadtest123"}]
    _test_data["stores"] = stores


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _login(client, email: str, password: str) -> tuple[str, str]:
    """
    POST /api/login/ and return (access_token, refresh_token).
    Raises RescheduleTask on auth failure so Locust retries with a different user.
    """
    resp = client.post(
        "/api/login/",
        json={"email": email, "password": password},
        name="/api/login/",
    )
    if resp.status_code != 200:
        raise RescheduleTask(
            f"Login failed for {email}: {resp.status_code} {resp.text[:200]}"
        )
    data = resp.json()
    access = data.get("access") or data.get("access_token", "")
    refresh = data.get("refresh") or data.get("refresh_token", "")
    return access, refresh


# ---------------------------------------------------------------------------
# ConsumerUser — weight=4
# ---------------------------------------------------------------------------

class ConsumerUser(HttpUser):
    """Simulates a student / consumer browsing and redeeming coupons."""

    weight = 4
    wait_time = between(1, 3)

    def on_start(self):
        students = _test_data.get("students", [])
        if not students:
            raise RescheduleTask("No student users available")

        cred = random.choice(students)
        self.token, self.refresh_tok = _login(self.client, cred["email"], cred["password"])
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

        # Pre-fetch coupon IDs for detail calls
        self.coupon_ids: list[int] = []
        resp = self.client.get("/api/store-coupons/", name="/api/store-coupons/ [warm-up]")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("results", data) if isinstance(data, dict) else data
            self.coupon_ids = [c["id"] for c in items if "id" in c][:50]

    @task(5)
    @tag("hot")
    def browse_store_coupons(self):
        resp = self.client.get("/api/store-coupons/", name="/api/store-coupons/")
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")

    @task(3)
    @tag("hot")
    def browse_exclusive_coupons(self):
        resp = self.client.get("/api/exclusive-coupons/", name="/api/exclusive-coupons/")
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")

    @task(2)
    @tag("hot")
    def view_user_stats(self):
        resp = self.client.get("/api/user-statistics/", name="/api/user-statistics/")
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")

    @task(1)
    @tag("medium")
    def view_coupon_detail(self):
        if not self.coupon_ids:
            return
        coupon_id = random.choice(self.coupon_ids)
        resp = self.client.get(f"/api/coupons/{coupon_id}/", name="/api/coupons/<id>/")
        if resp.status_code not in (200, 404):
            resp.failure(f"Expected 200/404, got {resp.status_code}")

    @task(1)
    @tag("medium")
    def view_progress_trackers(self):
        resp = self.client.get("/api/progress-trackers/", name="/api/progress-trackers/")
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")

    @task(1)
    @tag("low")
    def refresh_token(self):
        if not self.refresh_tok:
            return
        resp = self.client.post(
            "/api/token/refresh/",
            json={"refresh": self.refresh_tok},
            name="/api/token/refresh/",
        )
        if resp.status_code == 200:
            data = resp.json()
            new_access = data.get("access") or data.get("access_token")
            if new_access:
                self.token = new_access
                self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @task(1)
    @tag("low")
    def check_coupon_history(self):
        resp = self.client.get("/api/coupon-history/", name="/api/coupon-history/")
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")


# ---------------------------------------------------------------------------
# MerchantUser — weight=1
# ---------------------------------------------------------------------------

class MerchantUser(HttpUser):
    """Simulates a merchant managing coupon templates and QR sessions."""

    weight = 1
    wait_time = between(2, 5)

    def on_start(self):
        merchants = _test_data.get("merchants", [])
        if not merchants:
            raise RescheduleTask("No merchant users available")

        cred = random.choice(merchants)
        self.token, self.refresh_tok = _login(self.client, cred["email"], cred["password"])
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

        # Pre-fetch template IDs for analytics calls
        self.template_ids: list[int] = []
        self.qr_session_id: int | None = None

        resp = self.client.get(
            "/api/merchant/coupon-templates/",
            name="/api/merchant/coupon-templates/ [warm-up]",
        )
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("results", data) if isinstance(data, dict) else data
            self.template_ids = [t["id"] for t in items if "id" in t][:20]

    @task(3)
    @tag("hot")
    def list_templates(self):
        resp = self.client.get(
            "/api/merchant/coupon-templates/",
            name="/api/merchant/coupon-templates/",
        )
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")

    @task(2)
    @tag("hot")
    def get_merchant_stats(self):
        resp = self.client.get("/api/merchant/statistics/", name="/api/merchant/statistics/")
        if resp.status_code != 200:
            resp.failure(f"Expected 200, got {resp.status_code}")

    @task(2)
    @tag("medium")
    def get_template_analytics(self):
        if not self.template_ids:
            return
        template_id = random.choice(self.template_ids)
        resp = self.client.get(
            f"/api/merchant/coupon-templates/{template_id}/analytics/",
            name="/api/merchant/coupon-templates/<id>/analytics/",
        )
        if resp.status_code not in (200, 404):
            resp.failure(f"Expected 200/404, got {resp.status_code}")

    @task(1)
    @tag("medium")
    def generate_qr_session(self):
        if not self.template_ids:
            return
        template_id = random.choice(self.template_ids)
        resp = self.client.post(
            "/api/merchant/qr-session/generate/",
            json={"template_id": template_id},
            name="/api/merchant/qr-session/generate/",
        )
        if resp.status_code == 201:
            data = resp.json()
            self.qr_session_id = data.get("id") or data.get("session_id")
        elif resp.status_code not in (400, 404):
            resp.failure(f"Expected 201/400/404, got {resp.status_code}")

    @task(1)
    @tag("low")
    def invalidate_qr_session(self):
        if not self.qr_session_id:
            return
        session_id = self.qr_session_id
        self.qr_session_id = None  # clear before request to avoid duplicate invalidation
        resp = self.client.post(
            f"/api/merchant/qr-session/{session_id}/invalidate/",
            name="/api/merchant/qr-session/<id>/invalidate/",
        )
        if resp.status_code not in (200, 204, 404):
            resp.failure(f"Expected 200/204/404, got {resp.status_code}")


# ---------------------------------------------------------------------------
# AnonymousUser — weight=2
# ---------------------------------------------------------------------------

class AnonymousUser(HttpUser):
    """Simulates unauthenticated traffic: health probes and public legal content."""

    weight = 2
    wait_time = between(0.5, 2)

    _PUBLIC_LEGAL_ENDPOINTS = [
        "/api/privacy-policy/",
        "/api/terms/",
        "/api/content-guidelines/",
    ]

    @task(5)
    def health_check(self):
        resp = self.client.get("/api/health/", name="/api/health/")
        if resp.status_code != 200:
            resp.failure(f"Health check returned {resp.status_code}")

    @task(3)
    def ping(self):
        resp = self.client.get("/api/ping/", name="/api/ping/")
        if resp.status_code != 200:
            resp.failure(f"Ping returned {resp.status_code}")

    @task(2)
    def public_legal_content(self):
        endpoint = random.choice(self._PUBLIC_LEGAL_ENDPOINTS)
        resp = self.client.get(endpoint, name="/api/legal/<page>/")
        if resp.status_code != 200:
            resp.failure(f"{endpoint} returned {resp.status_code}")
