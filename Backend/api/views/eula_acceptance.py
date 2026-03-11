"""
EULA Acceptance Views
UGC Compliance (Apple Guideline 1.2) - User Story 3 & 5

Handles:
- Merchant EULA acceptance status checking
- EULA acceptance recording
- EULA content retrieval
- Content guidelines retrieval (public)
- Privacy policy retrieval (public)
"""

import os
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from ..models import EULAAcceptance, MerchantProfile
from ..serializers import EULAAcceptSerializer, EULAStatusSerializer


# Current EULA version (should match settings)
CURRENT_EULA_VERSION = getattr(settings, 'CURRENT_EULA_VERSION', '1.0.0')


class EULAStatusView(APIView):
    """
    GET /api/merchant/eula/status/
    Check if merchant has accepted current EULA version
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Check if user is merchant
        try:
            MerchantProfile.objects.get(user=request.user)
        except MerchantProfile.DoesNotExist:
            return Response(
                {'error': '此帳號不是商家帳號'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get latest acceptance record
        latest_acceptance = EULAAcceptance.objects.filter(
            merchant=request.user
        ).order_by('-accepted_at').first()

        if latest_acceptance:
            has_accepted = latest_acceptance.version == CURRENT_EULA_VERSION
            return Response({
                'has_accepted': has_accepted,
                'accepted_version': latest_acceptance.version,
                'current_version': CURRENT_EULA_VERSION,
                'needs_acceptance': not has_accepted,
                'accepted_at': latest_acceptance.accepted_at.isoformat()
            })
        else:
            return Response({
                'has_accepted': False,
                'accepted_version': None,
                'current_version': CURRENT_EULA_VERSION,
                'needs_acceptance': True,
                'accepted_at': None
            })


class EULAAcceptView(APIView):
    """
    POST /api/merchant/eula/accept/
    Record merchant's acceptance of current EULA version
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Check if user is merchant
        try:
            MerchantProfile.objects.get(user=request.user)
        except MerchantProfile.DoesNotExist:
            return Response(
                {'error': '此帳號不是商家帳號'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = EULAAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = serializer.validated_data['version']
        agreed = serializer.validated_data['agreed']

        # Validate agreed flag
        if not agreed:
            return Response(
                {'error': '請勾選同意使用條款'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate version matches current
        if version != CURRENT_EULA_VERSION:
            return Response(
                {'error': 'EULA 版本不符，請重新載入'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already accepted
        existing = EULAAcceptance.objects.filter(
            merchant=request.user,
            version=version
        ).first()

        if existing:
            return Response(
                {'error': '您已接受此版本的使用條款'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get client IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]
        else:
            ip_address = request.META.get('REMOTE_ADDR')

        # Create acceptance record
        acceptance = EULAAcceptance.objects.create(
            merchant=request.user,
            version=version,
            ip_address=ip_address
        )

        return Response({
            'id': acceptance.id,
            'version': acceptance.version,
            'accepted_at': acceptance.accepted_at.isoformat(),
            'message': '已接受使用條款'
        }, status=status.HTTP_201_CREATED)


class EULAContentView(APIView):
    """
    GET /api/merchant/eula/content/
    Retrieve current EULA text and content guidelines
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Read EULA file
        eula_path = os.path.join(settings.BASE_DIR, 'static', 'eula_zh.txt')
        guidelines_path = os.path.join(settings.BASE_DIR, 'static', 'guidelines_zh.txt')

        try:
            with open(eula_path, 'r', encoding='utf-8') as f:
                eula_content = f.read()
        except FileNotFoundError:
            eula_content = 'EULA 內容載入失敗'

        try:
            with open(guidelines_path, 'r', encoding='utf-8') as f:
                guidelines_content = f.read()
        except FileNotFoundError:
            guidelines_content = '內容規範載入失敗'

        return Response({
            'version': CURRENT_EULA_VERSION,
            'title': 'CouPro 使用者服務條款',
            'content': eula_content,
            'content_guidelines': guidelines_content,
            'penalties': self._get_penalties_text(),
            'last_updated': '2026-01-21T00:00:00Z'  # Hardcoded for now
        })

    def _get_penalties_text(self):
        """Generate penalties text"""
        return """
違規處理機制：

1. 首次違規：內容移除，發送警告通知
2. 累計 5 次違規：帳號警告，要求改善
3. 累計 10 次違規：觸發帳號審查程序，可能暫停服務
4. 嚴重違規：立即暫停帳號，不受次數限制

所有違規記錄將永久保存，作為帳號評估依據。
        """.strip()


class ContentGuidelinesView(APIView):
    """
    GET /api/content-guidelines/
    Retrieve content guidelines and penalty information (public)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        guidelines_path = os.path.join(settings.BASE_DIR, 'static', 'guidelines_zh.txt')

        try:
            with open(guidelines_path, 'r', encoding='utf-8') as f:
                guidelines_content = f.read()
        except FileNotFoundError:
            guidelines_content = '內容規範載入失敗'

        return Response({
            'prohibited_content': self._parse_prohibited_content(guidelines_content),
            'penalties': self._get_penalty_items(),
            'support_contact': 'coupro707@gmail.com'
        })

    def _parse_prohibited_content(self, content):
        """Parse prohibited content from guidelines file"""
        # Basic parsing - can be improved
        items = []
        items.append({
            'category': '不當內容',
            'description': '包含色情、暴力或其他不適當內容',
            'examples': ['色情圖片', '暴力內容', '仇恨言論']
        })
        items.append({
            'category': '誤導資訊',
            'description': '虛假或誤導性的優惠資訊',
            'examples': ['虛假折扣', '不實廣告', '過期優惠']
        })
        items.append({
            'category': '違法商品',
            'description': '違反法律的商品或服務',
            'examples': ['非法藥品', '侵權商品', '管制物品']
        })
        items.append({
            'category': '垃圾訊息',
            'description': '重複或無意義的內容',
            'examples': ['大量重複發布', '無關內容', '惡意廣告']
        })
        return items

    def _get_penalty_items(self):
        """Get penalty tier information"""
        return [
            {
                'violation_count': '1-4 次',
                'consequence': '內容移除，發送警告通知'
            },
            {
                'violation_count': '5-9 次',
                'consequence': '帳號警告，要求改善'
            },
            {
                'violation_count': '10 次以上',
                'consequence': '觸發帳號審查程序，可能暫停服務'
            }
        ]


class PrivacyPolicyView(APIView):
    """
    GET /api/privacy-policy/
    Retrieve privacy policy (public, no auth required)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        privacy_path = os.path.join(settings.BASE_DIR, 'static', 'privacy_zh.txt')

        try:
            with open(privacy_path, 'r', encoding='utf-8') as f:
                privacy_content = f.read()
        except FileNotFoundError:
            privacy_content = '隱私權政策載入失敗'

        return Response({
            'version': '1.0.0',
            'title': 'CouPro 隱私權政策',
            'content': privacy_content,
            'last_updated': '2026-01-21T00:00:00Z',
            'contact_email': 'privacy@coupro.com'
        })

