from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from drf_yasg.utils import swagger_auto_schema
import random
import string

from api.models import CouponTemplate, Coupon, StudentProfile, Log
from ..serializers import DrawCouponSerializer

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
    )
    
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
            'remaining_quantity': template.remaining_quantity
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
    """Try to draw a coupon from a template based on probability"""
    template_id = request.data.get('template_id')
    if not template_id:
        return Response({'error': 'Template ID is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get the template and verify it's active
        now = timezone.now()
        template = CouponTemplate.objects.get(
            id=template_id,
            is_active=True,
            remaining_quantity__gt=0,
            start_date__lte=now,
            expiry_date__gt=now
        )
          # Set user's last draw time in their StudentProfile
        try:
            student_profile = StudentProfile.objects.get(user=request.user)
            student_profile.last_draw_time = timezone.now()
            student_profile.save()
        except StudentProfile.DoesNotExist:
            # This shouldn't happen with proper permission checks
            pass
        
        # Determine if user successfully draws the coupon based on probability
        success = random.random() < template.draw_probability
        with transaction.atomic():
            if success:
                # Generate the coupon and assign to user
                coupon = template.generate_coupon(recipient=request.user)
                
                if coupon:

                    coupon.save()
                    
                    # Log the successful draw
                    Log.objects.create(
                        user=request.user,
                        coupon=coupon,
                        action='draw'
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
                # Log the unsuccessful draw
                Log.objects.create(
                    user=request.user,
                    action='draw'
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
    except Exception as e:
        return Response({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def draw_history(request):
    """Get user's draw history"""
    
    # Get all draw logs for the user
    draw_logs = Log.objects.filter(
        user=request.user,
        action='draw'
    ).order_by('-timestamp')
    
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