from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from api.models import StoreFixedSession


@api_view(['GET'])
@permission_classes([AllowAny])
def resolve_fixed_session(request, session_token):
    try:
        fixed_session = StoreFixedSession.objects.select_related('store').get(
            session_token=session_token,
            is_active=True,
        )
    except StoreFixedSession.DoesNotExist:
        return Response({'error': 'QR code 已過期或無效'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'store_id': fixed_session.store.id,
        'store_name': fixed_session.store.name,
    })
