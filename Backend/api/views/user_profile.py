from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from ..serializers import SetSavingsGoalSerializer
from ..models import StudentProfile, CompletedGoal, Coupon, CouponRedemption

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_statistics(request):
    """
    Get user statistics including savings data for the LargeWidget
    """
    try:
        student_profile = request.user.student_profile
        
        # Check if we need to reset monthly savings (new month)
        student_profile.update_monthly_savings()
        
        # Get savings goal info
        has_goal = bool(student_profile.savings_goal_amount)
        
        # Check if goal has been achieved, if so, reset the goal
        goal_achieved = False
        if has_goal and student_profile.monthly_savings >= student_profile.savings_goal_amount:
            goal_achieved = True
            # We don't automatically reset the goal here anymore
            # Instead we'll reset it when the user sets a new goal
        
        return Response({
            "coupons_used_count": student_profile.coupons_used_count,
            "total_savings": student_profile.total_savings,
            "monthly_savings": student_profile.monthly_savings,
            "last_savings_reset": student_profile.last_savings_reset,
            "has_goal": has_goal,
            "savings_goal_name": student_profile.savings_goal_name,
            "savings_goal_amount": student_profile.savings_goal_amount,
            "savings_goal_image": student_profile.savings_goal_image,
            "goal_progress": student_profile.monthly_savings / student_profile.savings_goal_amount if has_goal and student_profile.savings_goal_amount > 0 else 0,
            "goal_achieved": goal_achieved,
        })
    except (StudentProfile.DoesNotExist, AttributeError):
        # Handle case where user doesn't have a student profile
        return Response({
            "coupons_used_count": 0,
            "total_savings": 0,
            "monthly_savings": 0,
            "has_goal": False,
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coupon_history(request):
    """
    Get the user's coupon redemption history
    Returns a list of all coupons redeemed by the current user
    """
    try:
        # Get all coupon redemptions for the current user
        redemptions = CouponRedemption.objects.filter(
            user=request.user
        ).select_related('coupon', 'coupon__store').order_by('-redeemed_at')
        
        # Format the response data
        history = []
        for redemption in redemptions:
            coupon = redemption.coupon
            history.append({
                'redemption_id': redemption.id,  # Added the redemption ID
                'coupon_id': coupon.id,
                'store_name': coupon.store.name if coupon.store else '未知商家',
                'coupon_name': coupon.coupon_name,
                'coupon_detail': coupon.coupon_detail,
                'used_date': redemption.redeemed_at.isoformat() if redemption.redeemed_at else None,
                'estimated_savings': coupon.estimated_savings
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
    except Exception as e:
        print(f"Error retrieving coupon history: {e}")
        return Response(
            {'error': '無法取得優惠券使用紀錄'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coupon_history_detail(request, id):
    """
    Get detailed information about a specific redeemed coupon
    """
    try:
        # Get the specific redeemed coupon for the current user
        coupon = get_object_or_404(
            Coupon.objects.select_related('store'), 
            id=id, 
            redeemed_by=request.user,
            is_redeemed=True
        )
        
        # Format the response data
        data = {
            'coupon_id': coupon.id,
            'store_name': coupon.store.name if coupon.store else '未知商家',
            'coupon_name': coupon.coupon_name,
            'coupon_detail': coupon.coupon_detail,
            'used_date': coupon.redeemed_at.isoformat() if coupon.redeemed_at else None,
            'estimated_savings': coupon.estimated_savings
        }
        
        return Response(data)
    except Coupon.DoesNotExist:
        return Response(
            {'error': '找不到此優惠券使用紀錄'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error retrieving coupon history detail: {e}")
        return Response(
            {'error': '無法取得優惠券使用紀錄詳情'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@swagger_auto_schema(
        method='post',
        operation_description="Set or update the user's savings goal",
        request_body=SetSavingsGoalSerializer,
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_savings_goal(request):
    """
    Set/update the user's savings goal
    """
    goal_name = request.data.get('goal_name')
    goal_amount = request.data.get('goal_amount')
    goal_image = request.data.get('goal_image')
    
    if not goal_name or not goal_amount:
        return Response({'error': '目標名稱和金額為必填項目'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        goal_amount = float(goal_amount)
        if goal_amount <= 0:
            return Response({'error': '目標金額必須大於零'}, status=status.HTTP_400_BAD_REQUEST)
    except (ValueError, TypeError):
        return Response({'error': '目標金額必須為有效數字'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        student_profile = request.user.student_profile
         
        # Set the new goal
        student_profile.savings_goal_name = goal_name
        student_profile.savings_goal_amount = goal_amount
        if goal_image:
            student_profile.savings_goal_image = goal_image

        student_profile.save()
        
        return Response({
            "message": "儲蓄目標設定成功",
            "savings_goal_name": student_profile.savings_goal_name,
            "savings_goal_amount": student_profile.savings_goal_amount,
            "savings_goal_image": student_profile.savings_goal_image,
            "monthly_savings": 0,
            # "previous_goal_achieved": current_goal_achieved
        })
    except (StudentProfile.DoesNotExist, AttributeError):
        return Response({'error': '無法找到使用者資料'}, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
        method='post',
        operation_description="Add a completed goal to the user's badges",
        request_body=SetSavingsGoalSerializer,
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_completed_goal(request):
    """
    Add a completed goal to the user's badges
    """
    goal_name = request.data.get('goal_name')
    goal_amount = request.data.get('goal_amount')
    goal_image = request.data.get('goal_image')
    student_profile = request.user.student_profile
    
    if not goal_name or not goal_amount:
        return Response({'error': '目標名稱和金額為必填項目'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        goal_amount = float(goal_amount)
        if goal_amount <= 0:
            return Response({'error': '目標金額必須大於零'}, status=status.HTTP_400_BAD_REQUEST)
    except (ValueError, TypeError):
        return Response({'error': '目標金額必須為有效數字'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:        # Create the completed goal record
        completed_goal = CompletedGoal.objects.create(
            user=request.user,
            name=goal_name,
            amount=goal_amount,
            image=goal_image
        )

        # Convert goal_amount to Decimal before subtraction to avoid type error
        from decimal import Decimal
        student_profile.monthly_savings -= Decimal(str(goal_amount))
        student_profile.save()
        
        return Response({
            "message": "目標已新增至已完成列表",
            "id": completed_goal.id,
            "name": completed_goal.name,
            "amount": completed_goal.amount,
            "image": completed_goal.image,
            "completedDate": completed_goal.completed_date.isoformat()
        })
    except Exception as e:
        print(f"Error adding completed goal: {e}")
        return Response(
            {'error': f'無法新增目標: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_savings_goal(request):
    """
    Reset the user's savings goal
    If the goal was achieved, add it to completed goals
    """
    try:
        student_profile = request.user.student_profile 
        goal_achieved = False
 
        # Reset savings goal data
        student_profile.savings_goal_name = ""
        student_profile.savings_goal_amount = 0
        student_profile.savings_goal_image = ""
        student_profile.save()
        
        return Response({
            "message": "儲蓄目標已重置",
            "has_goal": False,
            "goal_was_achieved": goal_achieved
        })
    except (StudentProfile.DoesNotExist, AttributeError):
        return Response({'error': '無法找到使用者資料'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def completed_goals(request):
    """
    Get the list of completed goals (badges) for the current user
    """
    try:
        # Get all completed goals for the current user
        goals = CompletedGoal.objects.filter(user=request.user)
        
        # Format the response data
        completed_goals_data = []
        for goal in goals:
            completed_goals_data.append({
                'id': goal.id,
                'name': goal.name,
                'amount': goal.amount,
                'image': goal.image,
                'completedDate': goal.completed_date.isoformat(),
            })
        
        return Response(completed_goals_data)
    except Exception as e:
        print(f"Error retrieving completed goals: {e}")
        return Response(
            {'error': '無法取得已完成目標列表'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )