"""
Consumer profile endpoints (FE-contract-shaped).

GET    /api/profile/  → {id, email, phone, displayName, avatarUrl, phoneVerified}
PATCH  /api/profile/  → updates displayName and/or avatarUrl

These project the existing User + StudentProfile state into the camelCase
shape the mobile FE expects (Mobile-Frontend/src/services/api/profile.ts).

Phone numbers cannot be changed via PATCH — they require the OTP flow at
/api/phone-otp/send/ + /api/phone-otp/verify/. PATCH with a `phone` field
returns 409 with a hint.

Account deletion is handled by the existing /api/account/delete/ endpoint
(POST with {password, acknowledgments}). Phase 6 updates the FE service
module to call that path; this endpoint family stays GET/PATCH-only to keep
the deletion security model in one place.

Merchant accounts use /api/merchant/profile/ — this endpoint is consumer-only
but does not 403 merchants; it just returns the available fields (and the
merchant app should not be calling it).
"""

from __future__ import annotations

import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from api.exceptions import CouProAPIException
from api.models import StudentProfile
from api.serializers import ProfileUpdateSerializer

logger = logging.getLogger(__name__)


# Bounded length for display_name to mirror the model field and keep
# broadcast payloads small (consistent with the coop consumer's 40-char cap).
_DISPLAY_NAME_MAX = 80
_AVATAR_URL_MAX = 255


class PhoneChangeNotAllowed(CouProAPIException):
    """PATCH /api/profile/ does not accept phone — use the OTP flow."""

    status_code = status.HTTP_409_CONFLICT
    error_code = "PHONE_CHANGE_REQUIRES_OTP"
    default_detail = "Phone changes must go through /api/phone-otp/send/."


def _serialize_profile(user, student_profile: StudentProfile | None) -> dict:
    """Project User + StudentProfile into the FE UserProfile shape (camelCase)."""
    phone = None
    phone_verified = False
    display_name = None
    avatar_url = None

    if student_profile is not None:
        phone = student_profile.phone_number or None
        phone_verified = bool(student_profile.phone_verified)
        display_name = student_profile.display_name or None
        avatar_url = student_profile.avatar_url or None

    # Fall back to User.first_name when display_name hasn't been set yet.
    if not display_name:
        display_name = (user.first_name or user.username or '').strip() or None

    return {
        'id': str(user.id),
        'email': user.email or '',
        'phone': phone,
        'displayName': display_name,
        'avatarUrl': avatar_url,
        'phoneVerified': phone_verified,
    }


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Dispatch by method to keep the URL family flat and the FE contract clean."""
    user = request.user
    student_profile, _ = StudentProfile.objects.get_or_create(user=user)

    if request.method == 'GET':
        return Response(_serialize_profile(user, student_profile))

    # PATCH
    serializer = ProfileUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    if 'phone' in data:
        raise PhoneChangeNotAllowed(
            developer_message="PATCH /api/profile/ does not accept phone changes.",
            context={'hint': '/api/phone-otp/send/'},
        )

    dirty_fields: list[str] = []
    if 'displayName' in data:
        student_profile.display_name = (data['displayName'] or '').strip() or None
        dirty_fields.append('display_name')
    if 'avatarUrl' in data:
        student_profile.avatar_url = (data['avatarUrl'] or '').strip() or None
        dirty_fields.append('avatar_url')

    if dirty_fields:
        student_profile.save(update_fields=dirty_fields)
        logger.info(
            "profile.updated",
            extra={
                "user_id": user.id,
                "fields": dirty_fields,
            },
        )

    return Response(_serialize_profile(user, student_profile))
