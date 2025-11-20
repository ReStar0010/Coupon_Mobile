from django.contrib import admin
from .models import *

admin.site.register(StudentProfile)
admin.site.register(MerchantProfile)
admin.site.register(Store)
admin.site.register(Coupon)
admin.site.register(Log)
admin.site.register(CompletedGoal)
admin.site.register(CouponTemplate)
admin.site.register(CouponRedemption)
admin.site.register(CouponShareRequest)
admin.site.register(Tag)
# admin.site.register(PasswordResetProfile)