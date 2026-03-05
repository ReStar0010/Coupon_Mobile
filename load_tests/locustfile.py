"""
Locust load test: browse store coupons and redeem.
Stage 1/2: BrowseAndRedeemUser (browse, redeem store, redeem shared exclusive idempotency).
Stage 3/4: FullFlowUser (full consumer flow with configurable task weights).
Uses test_users.json, stores.json, task_weights.json, private_share_tokens.json (Stage 3+).
"""
import json
import os
import random
import time
from pathlib import Path

from locust import HttpUser, task, between  # type: ignore[import-untyped]

# Config: load from repo root
LOAD_TESTS_DIR = Path(__file__).resolve().parent
CONFIG_DIR = LOAD_TESTS_DIR / "config"
TEST_USERS_FILE = CONFIG_DIR / "test_users.json"
STORES_FILE = CONFIG_DIR / "stores.json"
TASK_WEIGHTS_FILE = CONFIG_DIR / "task_weights.json"
PRIVATE_SHARE_TOKENS_FILE = CONFIG_DIR / "private_share_tokens.json"

DEFAULT_TASK_WEIGHTS = {
    "browse_store_coupons": 10,
    "redeem_store_coupon": 2,
    "claim_public_pool": 1,
    "browse_exclusive_coupons": 5,
    "coupon_detail": 3,
    "share_private": 1,
    "accept_private_share": 1,
    "share_public": 1,
    "my_public_shares": 1,
    "daily_draw_templates": 2,
    "daily_draw": 1,
    "draw_history": 1,
    "redeem_shared_exclusive_idempotency": 0,
}


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


def load_task_weights():
    """Load task weights from task_weights.json; env TASK_WEIGHT_<KEY> overrides."""
    weights = dict(DEFAULT_TASK_WEIGHTS)
    if TASK_WEIGHTS_FILE.exists():
        try:
            with open(TASK_WEIGHTS_FILE, encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                for k, v in loaded.items():
                    if isinstance(v, (int, float)):
                        weights[k] = int(v)
        except (json.JSONDecodeError, OSError):
            pass
    for key in list(weights.keys()):
        env_key = "TASK_WEIGHT_" + key.upper()
        val = os.environ.get(env_key)
        if val is not None:
            try:
                weights[key] = int(val)
            except ValueError:
                pass
    return weights


def load_private_share_tokens():
    """Load list of tokens for accept_private_share task (Stage 3+)."""
    if not PRIVATE_SHARE_TOKENS_FILE.exists():
        return []
    try:
        with open(PRIVATE_SHARE_TOKENS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


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

STAGE = int(os.environ.get("STAGE", "1"))
TASK_WEIGHTS = load_task_weights() if STAGE >= 3 else {}
PRIVATE_SHARE_TOKENS = load_private_share_tokens() if STAGE >= 3 else []


def get_base_url():
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


class FullFlowUser(CouProUser):
    """Stage 3/4: full consumer flow — EasyUse, Collection, share, daily draw; task weights from config."""

    def browse_store_coupons(self):
        self.client.get("/api/store-coupons/", name="/api/store-coupons/")

    def redeem_store_coupon(self):
        r = self.client.get("/api/store-coupons/", name="/api/store-coupons/")
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, list) or not data:
            return
        store_items = [i for i in data if not i.get("is_public_share")]
        if not store_items:
            return
        item = random.choice(store_items)
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

    def claim_public_pool(self):
        r = self.client.get("/api/store-coupons/", name="/api/store-coupons/")
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, list):
            return
        public = [i for i in data if i.get("is_public_share") and i.get("share_token")]
        if not public:
            return
        item = random.choice(public)
        token = item.get("share_token")
        if not token:
            return
        self.client.get(
            f"/api/coupon/share/{token}/",
            name="/api/coupon/share/[token]/",
        )
        self.client.post(
            f"/api/coupon/share/{token}/accept/",
            json={},
            name="/api/coupon/share/[token]/accept/",
        )

    def browse_exclusive_coupons(self):
        self.client.get("/api/exclusive-coupons/", name="/api/exclusive-coupons/")

    def coupon_detail(self):
        r = self.client.get("/api/store-coupons/", name="/api/store-coupons/")
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, list) or not data:
            return
        item = random.choice(data)
        cid = item.get("id")
        if not cid:
            return
        self.client.get(f"/api/coupons/{cid}/", name="/api/coupons/[id]/")

    def share_private(self):
        r = self.client.get("/api/exclusive-coupons/", name="/api/exclusive-coupons/")
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, list) or not data:
            return
        item = random.choice(data)
        cid = item.get("id")
        if not cid:
            return
        self.client.post(
            f"/api/coupon/{cid}/share/",
            json={},
            name="/api/coupon/[id]/share/",
        )

    def accept_private_share(self):
        if not PRIVATE_SHARE_TOKENS:
            return
        token = random.choice(PRIVATE_SHARE_TOKENS)
        self.client.get(
            f"/api/coupon/share/{token}/",
            name="/api/coupon/share/[token]/",
        )
        self.client.post(
            f"/api/coupon/share/{token}/accept/",
            json={},
            name="/api/coupon/share/[token]/accept-private/",
        )

    def share_public(self):
        r = self.client.get("/api/exclusive-coupons/", name="/api/exclusive-coupons/")
        if r.status_code != 200:
            return
        data = r.json()
        if not isinstance(data, list) or not data:
            return
        item = random.choice(data)
        cid = item.get("id")
        if not cid:
            return
        self.client.post(
            f"/api/coupon/{cid}/share-public/",
            json={},
            name="/api/coupon/[id]/share-public/",
        )

    def my_public_shares(self):
        self.client.get("/api/my-public-shares/", name="/api/my-public-shares/")

    def daily_draw_templates(self):
        self.client.get(
            "/api/daily-draw-templates/",
            name="/api/daily-draw-templates/",
        )

    def daily_draw(self):
        r = self.client.get(
            "/api/daily-draw-templates/",
            name="/api/daily-draw-templates/",
        )
        if r.status_code != 200:
            return
        data = r.json()
        templates = data.get("active_templates") or []
        if not templates:
            return
        t = random.choice(templates)
        tid = t.get("id")
        if not tid:
            return
        self.client.post(
            "/api/coupon/daily-draw/",
            json={"template_id": tid},
            name="/api/coupon/daily-draw/",
        )

    def draw_history(self):
        self.client.get(
            "/api/coupon/draw-history/",
            name="/api/coupon/draw-history/",
        )

    def redeem_shared_exclusive_idempotency(self):
        if not SHARED_EXCLUSIVE:
            return
        self.client.post(
            f"/api/redeem/{SHARED_EXCLUSIVE['coupon_id']}/",
            json={"redeem_code": SHARED_EXCLUSIVE["redeem_code"]},
            name="/api/redeem/[id]-idempotency",
        )


# Assign task weights for FullFlowUser (only weights > 0)
FullFlowUser.tasks = [
    (FullFlowUser.browse_store_coupons, TASK_WEIGHTS.get("browse_store_coupons", 10)),
    (FullFlowUser.redeem_store_coupon, TASK_WEIGHTS.get("redeem_store_coupon", 2)),
    (FullFlowUser.claim_public_pool, TASK_WEIGHTS.get("claim_public_pool", 1)),
    (FullFlowUser.browse_exclusive_coupons, TASK_WEIGHTS.get("browse_exclusive_coupons", 5)),
    (FullFlowUser.coupon_detail, TASK_WEIGHTS.get("coupon_detail", 3)),
    (FullFlowUser.share_private, TASK_WEIGHTS.get("share_private", 1)),
    (FullFlowUser.accept_private_share, TASK_WEIGHTS.get("accept_private_share", 1)),
    (FullFlowUser.share_public, TASK_WEIGHTS.get("share_public", 1)),
    (FullFlowUser.my_public_shares, TASK_WEIGHTS.get("my_public_shares", 1)),
    (FullFlowUser.daily_draw_templates, TASK_WEIGHTS.get("daily_draw_templates", 2)),
    (FullFlowUser.daily_draw, TASK_WEIGHTS.get("daily_draw", 1)),
    (FullFlowUser.draw_history, TASK_WEIGHTS.get("draw_history", 1)),
    (FullFlowUser.redeem_shared_exclusive_idempotency, TASK_WEIGHTS.get("redeem_shared_exclusive_idempotency", 0)),
]
# Drop zero-weight tasks so Locust doesn't run them
FullFlowUser.tasks = [(t, w) for t, w in FullFlowUser.tasks if w > 0]

# Default user class: FullFlowUser for Stage 3/4, else BrowseAndRedeemUser
if STAGE >= 3:
    WebUser = FullFlowUser
else:
    WebUser = BrowseAndRedeemUser
