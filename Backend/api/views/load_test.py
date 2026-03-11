"""
Load test HTTP endpoints: verify-consistency (GET) and reset (POST).
Both require LOAD_TEST_SECRET (header X-Load-Test-Secret or Authorization: Bearer <token>).
Reset only clears redemptions and returns {ok: true}; config is shared via repo (see docs/load-test-deploy-and-reset-plan.md).
"""
import os

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt

from api.load_test_consistency import verify_load_test_consistency
from api.models import CouponRedemption


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


@require_GET
@require_load_test_secret
def load_test_verify_consistency(request):
    """GET /api/load-test/verify-consistency/ — returns {passed: bool, errors: list[str]}."""
    result = verify_load_test_consistency()
    return JsonResponse(result)


@require_http_methods(["POST"])
@csrf_exempt
@require_load_test_secret
def load_test_reset(request):
    """
    POST /api/load-test/reset/ — clear redemptions only; no seed, no config in response.
    Client uses shared repo config (load_tests/config/). Deploy runs seed_load_test so DB has data.
    Returns: {"ok": true} or {"ok": false, "error": "..."}.
    """
    try:
        CouponRedemption.objects.all().delete()
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)
    return JsonResponse({"ok": True})
