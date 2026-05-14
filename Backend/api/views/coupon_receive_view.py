"""
POST /api/coupon/receive/  (Phase 5)

Scan-to-receive coupon flow for the mobile FE's CouponReceiveQRScreen.

Accepts a single qrToken (a QRCodeSession.session_token from a merchant's
displayed QR) and a generated idempotency key, then runs the same claim
pipeline as /api/qr-claim/claim/ via the shared `claim_coupon_for_user`
service function (extracted from qr_claim.py — no private DRF coupling).
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.exceptions import CouProAPIException
from api.views.qr_claim import claim_coupon_for_user

logger = logging.getLogger(__name__)


class QrTokenRequired(CouProAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "QR_TOKEN_REQUIRED"
    default_detail = "qrToken is required."


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def receive_coupon(request):
    """POST /api/coupon/receive/  {qrToken, idempotencyKey?}.

    Returns the same payload as /api/qr-claim/claim/:
        {message, coupon_id, coupon_name, template_id, remaining_quantity,
         acquisition_method}
    """
    body = request.data if isinstance(request.data, dict) else {}
    qr_token = body.get('qrToken') or body.get('qr_token')
    idempotency_key = (
        body.get('idempotencyKey') or body.get('idempotency_key') or ''
    )

    if not isinstance(qr_token, str) or not qr_token.strip():
        raise QrTokenRequired(
            developer_message="POST /api/coupon/receive/ requires qrToken as a non-empty string.",
        )

    payload, http_status = claim_coupon_for_user(
        user=request.user,
        claim_token=qr_token.strip(),
        idempotency_key=idempotency_key if isinstance(idempotency_key, str) else '',
    )
    return Response(payload, status=http_status)
