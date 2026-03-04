"""
Locust load test: browse store coupons and redeem.
Uses test_users.json (one credential per virtual user) and stores.json (unified_redeem_code per store).
"""
import json
import random
import time
from pathlib import Path

from locust import HttpUser, task, between

# Config: load from repo root
LOAD_TESTS_DIR = Path(__file__).resolve().parent
CONFIG_DIR = LOAD_TESTS_DIR / "config"
TEST_USERS_FILE = CONFIG_DIR / "test_users.json"
STORES_FILE = CONFIG_DIR / "stores.json"


def load_test_users():
    if not TEST_USERS_FILE.exists():
        return []
    with open(TEST_USERS_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_stores():
    if not STORES_FILE.exists():
        return []
    with open(STORES_FILE, encoding="utf-8") as f:
        return json.load(f)


# Load once at module level (runner ensures seed has run)
TEST_USERS = load_test_users()
STORES = load_stores()
# Map store_id -> unified_redeem_code
STORE_CODES = {s["store_id"]: s["unified_redeem_code"] for s in STORES}
# Stage 2 idempotency: one shared exclusive coupon (many users try, at most one succeeds)
SHARED_EXCLUSIVE = None
if STORES and STORES[0].get("shared_exclusive_coupon_id"):
    SHARED_EXCLUSIVE = {
        "coupon_id": STORES[0]["shared_exclusive_coupon_id"],
        "redeem_code": STORES[0]["unified_redeem_code"],
    }


def get_base_url():
    import os
    url = os.environ.get("BASE_URL", "http://localhost:8000")
    return url.rstrip("/")


class CouProUser(HttpUser):
    """Simulated user: login, browse store coupons, redeem a store coupon."""

    abstract = True
    host = get_base_url()

    def on_start(self):
        if not TEST_USERS:
            return
        cred = random.choice(TEST_USERS)
        email = cred.get("email")
        password = cred.get("password")
        if not email or not password:
            return
        while True:
            r = self.client.post(
                "/api/login/",
                json={
                    "email": email,
                    "password": password,
                    "client_type": "user",
                },
                name="/api/login/",
            )
            if r.status_code == 200 and "access_token" in r.json():
                token = r.json()["access_token"]
                self.client.headers["Authorization"] = f"Bearer {token}"
                break
            time.sleep(1)

    wait_time = between(0.5, 2.0)


class BrowseAndRedeemUser(CouProUser):
    """Stage 1: browse store coupons, then redeem one (store coupon with unified code)."""

    @task(10)
    def browse_store_coupons(self):
        self.client.get("/api/store-coupons/", name="/api/store-coupons/")

    @task(1)
    def redeem_store_coupon(self):
        r = self.client.get("/api/store-coupons/", name="/api/store-coupons/")
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, list) or not data:
            return
        # Pick a random store coupon (each item has id, store_id, ...)
        item = random.choice(data)
        coupon_id = item.get("id")
        store_id = item.get("store_id")
        if not coupon_id or not store_id:
            return
        code = STORE_CODES.get(store_id)
        if not code:
            return
        self.client.post(
            f"/api/redeem/{coupon_id}/",
            json={"redeem_code": code},
            name="/api/redeem/[id]/",
        )

    @task(1)
    def redeem_shared_exclusive_idempotency(self):
        """Stage 2: many users redeem same coupon_id; at most one success (4xx for duplicates)."""
        if not SHARED_EXCLUSIVE:
            return
        self.client.post(
            f"/api/redeem/{SHARED_EXCLUSIVE['coupon_id']}/",
            json={"redeem_code": SHARED_EXCLUSIVE["redeem_code"]},
            name="/api/redeem/[id]-idempotency",
        )


# Default user class for Locust (host from BASE_URL; -H overrides)
class WebUser(BrowseAndRedeemUser):
    pass
