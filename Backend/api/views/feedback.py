"""
User feedback submission endpoint.

Implements:
  POST /api/feedback/

Uses Resend to deliver emails inside the CouPro app flow (no mail-app switching).
"""

from __future__ import annotations

import logging

import resend
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.utils.html import escape
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from api.exceptions import EmailSendFailed
from api.serializers import FeedbackSubmitSerializer

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_feedback(request):
    serializer = FeedbackSubmitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    feedback_type = serializer.validated_data["feedback_type"]
    details = serializer.validated_data["details"].strip()

    user_email = getattr(request.user, "email", "") or ""
    user_phone = ""
    try:
        user_phone = (request.user.student_profile.phone_number or "").strip()
    except ObjectDoesNotExist:
        pass

    type_zh = "Bug 回報" if feedback_type == "bug" else "功能建議"

    contact_hint = user_email or user_phone or "unknown"
    subject = f"[CouPro] {type_zh} - {contact_hint}"

    # Avoid breaking HTML with user-controlled content.
    html_content = f"""
    <h2>CouPro 使用者回饋</h2>
    <ul>
      <li><strong>類型：</strong>{escape(type_zh)}</li>
      <li><strong>使用者 Email：</strong>{escape(user_email or '—')}</li>
      <li><strong>使用者電話：</strong>{escape(user_phone or '—')}</li>
    </ul>
    <p><strong>內容：</strong></p>
    <pre style="white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
    {escape(details)}
    </pre>
    """

    try:
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send(
            {
                "from": "CouPro <noreply@coupro.pro>",
                "to": [settings.SUPPORT_EMAIL],
                "subject": subject,
                "html": html_content,
            }
        )
        return Response({"message": "ok"}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.exception("Failed to send user feedback email: %s", e)
        raise EmailSendFailed(
            developer_message="回饋寄送失敗，請稍後再試。", context={"feedback_type": feedback_type}
        )

