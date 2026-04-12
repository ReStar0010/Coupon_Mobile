from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from api.models import QRCodeSession


@api_view(['GET'])
@permission_classes([AllowAny])
def resolve_session(request, session_token):
    try:
        session = QRCodeSession.objects.select_related('template__store').get(
            session_token=session_token,
            is_active=True,
        )
    except QRCodeSession.DoesNotExist:
        return Response({'error': 'QR code 已過期或無效'}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        'store_id': session.template.store.id,
        'store_name': session.template.store.name,
        'template_id': session.template.id,
    })
