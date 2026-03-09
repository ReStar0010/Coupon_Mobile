"""
Load test HTTP endpoints: verify-consistency (GET) and reset (POST).
Both require LOAD_TEST_SECRET (header X-Load-Test-Secret or Authorization: Bearer <token>).
"""
import json
import os

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt

from api.load_test_consistency import verify_load_test_consistency
from api.models import CouponRedemption

# Same keys as load_tests/locustfile.py DEFAULT_TASK_WEIGHTS
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


def _get_load_test_secret_from_request(request):
    """Extract secret from X-Load-Test-Secret header or Authorization: Bearer <token>."""
    secret = request.headers.get("X-Load-Test-Secret")
    if secret:
        return secret
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


def require_load_test_secret(view_func):
    """Decorator: return 401 JsonResponse if LOAD_TEST_SECRET is missing or wrong."""

    def wrapped(request, *args, **kwargs):
        expected = os.environ.get("LOAD_TEST_SECRET")
        if not expected:
            return JsonResponse({"error": "Unauthorized"}, status=401)
        provided = _get_load_test_secret_from_request(request)
        if not provided or provided != expected:
            return JsonResponse({"error": "Unauthorized"}, status=401)
        return view_func(request, *args, **kwargs)

    return wrapped


def build_load_test_config(credentials, store_codes, private_share_tokens, stage):
    """Build full config dict for Locust: test_users, stores, task_weights, private_share_tokens."""
    tokens = private_share_tokens if stage >= 3 else []
    return {
        "test_users": credentials,
        "stores": store_codes,
        "task_weights": DEFAULT_TASK_WEIGHTS,
        "private_share_tokens": tokens,
    }


@require_GET
@require_load_test_secret
def load_test_verify_consistency(request):
    """GET /api/load-test/verify-consistency/ — returns {passed: bool, errors: list[str]}."""
    result = verify_load_test_consistency()
    return JsonResponse(result)


def _parse_reset_body(request):
    """Parse stage and optional config from request body. Returns (stage, config or None)."""
    stage = 1
    config = None
    if request.GET.get("stage"):
        try:
            stage = int(request.GET["stage"])
        except (ValueError, TypeError):
            pass
    if request.body and request.content_type and "application/json" in request.content_type:
        try:
            body = json.loads(request.body)
            if isinstance(body.get("stage"), int) and body["stage"] in (1, 2, 3, 4):
                stage = body["stage"]
            if isinstance(body.get("config"), dict):
                cfg = body["config"]
                if cfg.get("test_users") and cfg.get("stores"):
                    config = cfg
        except (json.JSONDecodeError, TypeError):
            pass
    if stage not in (1, 2, 3, 4):
        stage = 1
    return stage, config


@require_http_methods(["POST"])
@csrf_exempt
@require_load_test_secret
def load_test_reset(request):
    """
    POST /api/load-test/reset/ — clear redemptions, run seed for stage, return config.
    Body: {"stage": N} or {"stage": N, "config": {...}} to use pushed config (seed from config).
    When config is provided: test_users and stores (unified_redeem_code) are used; stores in
    response have actual store_id for this DB.
    Returns: {"ok": true, "config": {...}} or {"ok": false, "error": "..."}.
    """
    stage, config = _parse_reset_body(request)

    try:
        CouponRedemption.objects.all().delete()
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

    try:
        if config is not None:
            from api.management.commands.seed_load_test import seed_from_config
            credentials, store_codes, private_share_tokens = seed_from_config(config, stage)
        else:
            from api.management.commands.seed_load_test import run_seed
            credentials, store_codes, private_share_tokens = run_seed(stage)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

    out_config = build_load_test_config(
        credentials, store_codes, private_share_tokens, stage
    )
    if config is not None:
        out_config["test_users"] = config.get("test_users", credentials)
        out_config["task_weights"] = config.get("task_weights") or out_config["task_weights"]
        out_config["private_share_tokens"] = config.get("private_share_tokens", private_share_tokens)
    return JsonResponse({"ok": True, "config": out_config})
