import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from drf_yasg.utils import swagger_auto_schema
import secrets as _secrets

from api.models import CouponTemplate, Coupon, StudentProfile, Log, DailyDrawAttempt
from api.exceptions import CouponTemplateNotFound, UserNotFound
from ..serializers import DrawCouponSerializer

_sysrand = _secrets.SystemRandom()

logger = logging.getLogger(__name__)

def generate_random_code(length=6):
    """Generate a random alphanumeric code for coupon redemption"""
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_daily_draw_templates(request):
    """Returns active coupon templates available for daily draw"""
    # Get active templates available for drawing
    now = timezone.now()
    
    # Get active templates with remaining quantity
    active_templates = CouponTemplate.objects.filter(
        is_active=True,
        remaining_quantity__gt=0,
        start_date__lte=now,
        expiry_date__gt=now
    ).select_related('store')
    
    result = []
    for template in active_templates:
        result.append({
            'id': template.id,
            'store_id': template.store.id,
            'store_name': template.store.name,
            'coupon_name': template.coupon_name,
            'image_url': template.image_url,
            'estimated_savings': template.estimated_savings,
            'expiry_date': template.expiry_date,
            'remaining_quantity': template.remaining_quantity,
            'draw_probability': template.draw_probability
        })
    
    return Response({
        'active_templates': result
    })

@swagger_auto_schema(
        method='post',
        operation_description="Draw a coupon from a template based on probability",
        request_body=DrawCouponSerializer
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def draw_coupon(request):
    """Try to draw a coupon from a template based on probability.

    When ``template_id`` is omitted, the server selects a template from the
    active pool weighted by ``draw_probability``.
    """
    template_id = request.data.get('template_id')

    try:
        now = timezone.now()
        active_qs = CouponTemplate.objects.filter(
            is_active=True,
            remaining_quantity__gt=0,
            start_date__lte=now,
            expiry_date__gt=now,
        ).select_related('store')

        if template_id:
            template = active_qs.get(id=template_id)
        else:
            candidates = list(active_qs)
            if not candidates:
                return Response({
                    'success': False,
                    'message': 'No coupons remaining',
                }, status=status.HTTP_400_BAD_REQUEST)
            weights = [t.draw_probability for t in candidates]
            template = _sysrand.choices(candidates, weights=weights, k=1)[0]

        try:
            student_profile = StudentProfile.objects.get(user=request.user)
        except StudentProfile.DoesNotExist:
            logger.warning(
                "StudentProfile not found for authenticated user %s during daily draw",
                request.user.id,
            )
            raise UserNotFound(
                developer_message=(
                    f"StudentProfile not found for authenticated user {request.user.id} during daily draw"
                )
            )

        success = _sysrand.random() < template.draw_probability
        with transaction.atomic():
            # Update last_draw_time atomically with the coupon + attempt
            # writes. Previously this was outside the atomic block, so a
            # failed generate_coupon left an updated last_draw_time
            # pointing at a draw that never produced an outcome — fixed
            # in code-review.
            student_profile.last_draw_time = timezone.now()
            student_profile.save(update_fields=['last_draw_time'])
            if success:
                # Generate the coupon and assign to user
                coupon = template.generate_coupon(recipient=request.user)

                if coupon:
                    # Set acquisition method to 'draw'
                    coupon.acquisition_method = 'draw'
                    coupon.save()

                    # Persist the attempt for admin/analytics visibility.
                    # Snapshot draw_probability so a future template edit
                    # can't rewrite history. Inside the same atomic block
                    # as coupon creation — orphan attempts are impossible.
                    DailyDrawAttempt.objects.create(
                        user=request.user,
                        template=template,
                        success=True,
                        awarded_coupon=coupon,
                        draw_probability=template.draw_probability,
                    )

                    # Log the successful draw
                    logger.info(
                        "Daily draw successful",
                        extra={
                            "user_id": request.user.id,
                            "username": request.user.username,
                            "email": request.user.email,
                            "action": "daily_draw_success",
                            "template_id": template.id,
                            "template_name": template.coupon_name,
                            "coupon_id": coupon.id,
                            "coupon_name": coupon.coupon_name,
                            "coupon_detail": coupon.coupon_detail,
                            "coupon_type": coupon.coupon_type,
                            "store_name": coupon.store.name,
                        }
                    )
                    # Return coupon details
                    return Response({
                        'success': True,
                        'coupon': {
                            'id': coupon.id,
                            'name': coupon.coupon_name,
                            'detail': coupon.coupon_detail,
                            'important_notes': coupon.important_notes,
                            'image_url': coupon.image_url,
                            'store_name': coupon.store.name,
                            'expiry_date': coupon.expiry_date,
                            'redeem_code': coupon.redeem_code,
                            'estimated_savings': coupon.estimated_savings
                        },
                        'message': f'Congratulations! You drew the {coupon.coupon_name} coupon!'
                    })
                else:
                    # This shouldn't happen given our filters above, but just in case
                    return Response({
                        'success': False,
                        'message': 'No coupons remaining'
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Persist the miss attempt (no awarded_coupon).
                DailyDrawAttempt.objects.create(
                    user=request.user,
                    template=template,
                    success=False,
                    awarded_coupon=None,
                    draw_probability=template.draw_probability,
                )

                # Log the unsuccessful draw
                logger.info(
                    "Daily draw unsuccessful",
                    extra={
                        "user_id": request.user.id,
                        "username": request.user.username,
                        "email": request.user.email,
                        "action": "daily_draw_unsuccessful",
                        "template_id": template.id,
                        "template_name": template.coupon_name,
                        "draw_probability": template.draw_probability,
                    }
                )
                
                return Response({
                    'success': False,
                    'message': 'Better luck next time! You did not win a coupon.'
                })
                
    except CouponTemplate.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Coupon template not found or not active'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        logger.exception("Unexpected error during daily draw for user %s", request.user.id)
        return Response({
            'success': False,
            'message': 'An unexpected error occurred. Please try again later.',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def draw_history(request):
    """Get user's draw history"""
    
    draw_logs = Log.objects.filter(
        user=request.user,
        action='draw',
    ).select_related('coupon__store').order_by('-timestamp')[:50]
    
    history = []
    for log in draw_logs:
        entry = {
            'timestamp': log.timestamp,
            'success': log.coupon is not None
        }
        
        # Add coupon details if successful
        if log.coupon:
            entry['coupon'] = {
                'id': log.coupon.id,
                'name': log.coupon.coupon_name,
                'store_name': log.coupon.store.name,
                'estimated_savings': log.coupon.estimated_savings,
                'expiry_date': log.coupon.expiry_date
            }
            
        history.append(entry)
        
    return Response({
        'history': history
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_last_draw_time(request):
    """Get the last draw time for the user"""
    try:
        # Get the student profile which has the last_draw_time field
        student_profile = StudentProfile.objects.get(user=request.user)
        last_draw_time = student_profile.last_draw_time
        
        if last_draw_time:
            # Format date as YYYY-MM-DD to match frontend expectations
            last_draw_date = last_draw_time.date().isoformat()
            return Response({
                'last_draw_date': last_draw_date,
                'last_draw_time': last_draw_time
            })
        else:
            return Response({
                'last_draw_date': None,
                'last_draw_time': None
            })
    except StudentProfile.DoesNotExist:
        return Response({
            'last_draw_date': None,
            'last_draw_time': None
        })
    except Exception as e:
        return Response(
            {'error': f'Error fetching last draw time: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )