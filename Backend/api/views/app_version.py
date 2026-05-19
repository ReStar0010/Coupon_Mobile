"""
App-version metadata endpoint.

GET /api/app/version-info/?platform=ios|android

Returns the minimum supported native app version (force-update floor)
and the latest published version (soft-update suggestion) along with
the platform-appropriate store URL. The FE compares the device's
`Application.nativeApplicationVersion` against these to decide whether
to show:
  - a blocking modal (current < min) — force upgrade
  - a dismissible banner (current < latest) — recommend upgrade
  - nothing (current >= latest)

Static config in settings; env-overridable. No DB, no auth — the value
is the same for every user and the FE needs it before the user signs in
so we can block a stale install from hitting newer endpoints.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

logger = logging.getLogger(__name__)


class VersionInfoThrottle(AnonRateThrottle):
    """Dedicated rate for the public version-info endpoint.

    The 60/hour global anon throttle is too coarse for an endpoint that
    every install hits on every cold start. A 10/minute per-IP ceiling
    is enough headroom for legitimate first-launch + foreground transitions
    while making the endpoint useless for amplification from a single IP.
    """

    scope = 'version_info'


# Defaults — overridable by env via settings.APP_VERSION_INFO at deploy time.
_DEFAULT_VERSION_INFO = {
    'ios': {
        'minVersion': '1.0.0',
        'latestVersion': '1.0.3',
        'storeUrl': 'https://apps.apple.com/app/id0000000000',
    },
    'android': {
        'minVersion': '1.0.0',
        'latestVersion': '1.0.3',
        'storeUrl': 'https://play.google.com/store/apps/details?id=com.cokayne.MobileFrontend',
    },
}


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([VersionInfoThrottle])
@never_cache
def version_info(request):
    """Return minVersion / latestVersion / storeUrl for the given platform.

    `@never_cache` is critical here: a CDN or reverse proxy that caches
    this response would defeat the force-upgrade mechanism. If we bump
    `minVersion` after a security patch, every stale cache node would
    keep serving the old floor and let vulnerable installs through.
    """
    platform = (request.query_params.get('platform') or '').lower()
    if platform not in ('ios', 'android'):
        return Response(
            {
                'error': 'platform query param must be "ios" or "android".',
                'code': 'APP_VERSION_PLATFORM_INVALID',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # The settings.APP_VERSION_INFO override wins per platform when
    # present so we can ship a force-upgrade without a code deploy.
    config = getattr(settings, 'APP_VERSION_INFO', _DEFAULT_VERSION_INFO)
    row = config.get(platform) or _DEFAULT_VERSION_INFO[platform]
    return Response(
        {
            'platform': platform,
            'minVersion': row.get('minVersion', _DEFAULT_VERSION_INFO[platform]['minVersion']),
            'latestVersion': row.get('latestVersion', _DEFAULT_VERSION_INFO[platform]['latestVersion']),
            'storeUrl': row.get('storeUrl', _DEFAULT_VERSION_INFO[platform]['storeUrl']),
        }
    )
