"""
Wallet read endpoint.

Returns the authenticated user's CouGem + CouPoint balance from the single
source of truth (api.spinner_coop.models.Wallet). On first read, lazily
creates the wallet row with a STARTER_GEMS seed credit (logged via a
WalletTransaction of kind='seed' for history visibility).

Mutations live in spinner_views / coupoint_views (Phase 2); this is read-only.
"""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.spinner_coop.wallet_service import WalletService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    """GET /api/wallet/ → {gems, couPoints}.

    Lazily ensures the user has a Wallet row, seeding with settings.STARTER_GEMS
    on first creation. Subsequent calls return the current balance.

    Response shape mirrors the mobile FE WalletData contract (camelCase).
    """
    starter = max(0, int(getattr(settings, 'STARTER_GEMS', 0)))
    wallet = WalletService.ensure_wallet(request.user.id, initial_gems=starter)
    return Response({
        'gems': wallet.gems,
        'couPoints': wallet.cou_points,
    })
