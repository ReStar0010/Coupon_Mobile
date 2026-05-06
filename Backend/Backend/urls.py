from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, JsonResponse
from django.db import OperationalError, connection
from django.contrib.admin.views.decorators import staff_member_required
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from api.views.sharing_views import (
    collection_landing,
    claim_landing,
    claim_fixed_landing,
    voucher_landing,
    apple_app_site_association,
    assetlinks_json,
)
from api.views.load_test import load_test_verify_consistency, load_test_reset
import logging

logger = logging.getLogger(__name__)


def trigger_sentry_error(request):
    raise Exception("This is a test error")


def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok", "db": "ok"})
    except OperationalError as e:
        # Expected when DB is unreachable; avoid error+exc_info so Sentry is not flooded from probes.
        logger.warning("Health check database query failed: %s", e)
        return JsonResponse({"status": "error", "db": str(e)}, status=503)
    except Exception as e:
        logger.error("Health check failed unexpectedly: %s", e, exc_info=True)
        return JsonResponse({"status": "error", "db": str(e)}, status=503)


schema_view = get_schema_view(
    openapi.Info(
        title="CouBox API",
        default_version='v1',
        description="CouBox mobile coupon platform API",
        terms_of_service="https://coupro-terms.vercel.app/terms.html",
        contact=openapi.Contact(email="coupro707@gmail.com"),
        license=openapi.License(name="Proprietary"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # API docs
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    re_path(r'^swagger/$', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    re_path(r'^redoc/$', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),

    # Domain URL modules
    path('api/', include('api.urls.auth_urls')),
    path('api/', include('api.urls.coupon_urls')),
    path('api/', include('api.urls.merchant_urls')),
    path('api/', include('api.urls.user_urls')),
    path('api/', include('api.urls.moderation_urls')),
    path('api/', include('api.urls.web_v1_urls')),

    # Universal Links fallback pages (https://api.coupro.pro/collection/<token>)
    path('collection/<str:token>/', collection_landing, name='collection_landing'),
    path('claim/<str:token>/', claim_landing, name='claim_landing'),
    path('claim-fixed/<str:token>/', claim_fixed_landing, name='claim_fixed_landing'),
    path('cl/<str:token>/', claim_landing, name='claim_landing_short'),
    path('voucher/<str:token>/', voucher_landing, name='voucher_landing'),

    # iOS/Android app association verification
    path('.well-known/apple-app-site-association', apple_app_site_association, name='apple_app_site_association'),
    path('.well-known/assetlinks.json', assetlinks_json, name='assetlinks_json'),

    # Health + maintenance
    path('api/ping/', lambda request: HttpResponse("Pong!")),
    path('api/health/', health_check, name='health_check'),
    path('api/test-sentry/', staff_member_required(trigger_sentry_error), name='trigger_sentry_error'),
    path('api/load-test/verify-consistency/', staff_member_required(load_test_verify_consistency)),
    path('api/load-test/reset/', staff_member_required(load_test_reset)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
