from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Group, User
from django.test import RequestFactory, TestCase

from api.admin import MerchantProfileAdmin
from api.models import MerchantProfile


class MerchantApplicationAdminTest(TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.factory = RequestFactory()
        self.model_admin = MerchantProfileAdmin(MerchantProfile, self.site)

        self.admin_user = User.objects.create_superuser(
            username='admin@example.com',
            email='admin@example.com',
            password='adminpass123',
        )
        self.merchant_group, _ = Group.objects.get_or_create(name='Merchant')

        self.pending_merchant = User.objects.create_user(
            username='pending@example.com',
            email='pending@example.com',
            password='testpass123',
        )
        self.pending_merchant.groups.add(self.merchant_group)
        self.profile = MerchantProfile.objects.create(
            user=self.pending_merchant,
            phone='0912345678',
            contact_person='Pending Merchant',
            contact_info='line@pending',
            verified=True,
            application_status='pending',
        )

    def test_approve_applications_marks_profile_approved_and_sends_email(self):
        request = self.factory.post('/admin/api/merchantprofile/')
        request.user = self.admin_user
        queryset = MerchantProfile.objects.filter(pk=self.profile.pk)

        with patch.object(self.model_admin, 'message_user'), patch(
            'api.admin.send_merchant_application_approved_email'
        ) as mock_email:
            self.model_admin.approve_applications(request, queryset)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.application_status, 'approved')
        self.assertIsNotNone(self.profile.application_reviewed_at)
        mock_email.assert_called_once_with(self.profile.user.email)

    def test_reject_applications_marks_profile_rejected_and_sends_email(self):
        request = self.factory.post('/admin/api/merchantprofile/')
        request.user = self.admin_user
        queryset = MerchantProfile.objects.filter(pk=self.profile.pk)

        with patch.object(self.model_admin, 'message_user'), patch(
            'api.admin.send_merchant_application_rejected_email'
        ) as mock_email:
            self.model_admin.reject_applications(request, queryset)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.application_status, 'rejected')
        self.assertIsNotNone(self.profile.application_reviewed_at)
        mock_email.assert_called_once_with(self.profile.user.email)
