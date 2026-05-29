from django.urls import path
from api.views.authentication import (
    register, login, logout, user_info, verify_email, request_email_verification,
    forgot_password, reset_password, refresh_token,
    verify_merchant_email, resend_merchant_verification,
    redirect_verify_email, redirect_reset_password,
)
from api.views.phone_otp import (
    send_otp, verify_otp, check_registration_phone,
    send_registration_otp, verify_registration_otp,
    send_password_reset_otp, verify_password_reset_otp,
)

app_name = 'auth'

urlpatterns = [
    path('register/', register),
    path('login/', login),
    path('logout/', logout),
    path('token/refresh/', refresh_token, name='token_refresh'),
    path('verify-email/', verify_email),
    path('email-settings/send-verification/', request_email_verification, name='request_email_verification'),
    path('merchant/verify-email/', verify_merchant_email, name='verify_merchant_email'),
    path('merchant/resend-verification/', resend_merchant_verification, name='resend_merchant_verification'),
    path('merchant/redirect/verify-email', redirect_verify_email, name='redirect_verify_email'),
    path('merchant/redirect/reset-password', redirect_reset_password, name='redirect_reset_password'),
    path('forgot-password/', forgot_password, name='forgot_password'),
    path('reset-password/', reset_password, name='reset_password'),
    path('register/check-phone/', check_registration_phone, name='check_registration_phone'),
    path('register/send-otp/', send_registration_otp, name='send_registration_otp'),
    path('register/verify-otp/', verify_registration_otp, name='verify_registration_otp'),
    path('forgot-password/phone/send-otp/', send_password_reset_otp, name='send_password_reset_otp'),
    path('forgot-password/phone/reset/', verify_password_reset_otp, name='verify_password_reset_otp'),
    path('user-info/', user_info),
    path('phone-otp/send/', send_otp, name='send_otp'),
    path('phone-otp/verify/', verify_otp, name='verify_otp'),
]
