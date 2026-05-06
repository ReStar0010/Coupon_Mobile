"""Unit tests for api/services/email_service.py"""
import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.django_db
class TestSendVerificationEmail:
    def test_send_verification_email_calls_resend(self):
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'test-id'}
            from api.services.email_service import send_verification_email
            result = send_verification_email('test@example.com', 'token123')
            assert result is True
            mock_send.assert_called_once()

    def test_send_verification_email_returns_false_on_failure(self):
        with patch('resend.Emails.send', side_effect=Exception("Resend error")):
            from api.services.email_service import send_verification_email
            result = send_verification_email('test@example.com', 'token456')
            assert result is False

    def test_send_verification_email_payload_contains_recipient(self):
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'test-id'}
            from api.services.email_service import send_verification_email
            send_verification_email('user@example.com', 'mytoken')
            call_args = mock_send.call_args[0][0]
            assert call_args['to'] == 'user@example.com'


@pytest.mark.django_db
class TestSendPasswordResetEmail:
    def test_send_password_reset_email_student(self):
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'test-id'}
            from api.services.email_service import send_password_reset_email
            result = send_password_reset_email('user@example.com', 'resettoken', is_merchant=False)
            assert result is True

    def test_send_password_reset_email_merchant(self):
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'test-id'}
            from api.services.email_service import send_password_reset_email
            result = send_password_reset_email('merchant@example.com', 'merchanttoken', is_merchant=True)
            assert result is True

    def test_send_password_reset_email_raises_on_rate_limit(self):
        with patch('resend.Emails.send', side_effect=Exception("rate_limit exceeded")):
            from api.services.email_service import send_password_reset_email
            with pytest.raises(Exception, match='暫時無法使用'):
                send_password_reset_email('user@example.com', 'tok', is_merchant=False)

    def test_send_password_reset_email_raises_on_invalid_key(self):
        with patch('resend.Emails.send', side_effect=Exception("invalid API key unauthorized")):
            from api.services.email_service import send_password_reset_email
            with pytest.raises(Exception, match='配置錯誤'):
                send_password_reset_email('user@example.com', 'tok', is_merchant=False)


@pytest.mark.django_db
class TestSendMerchantApprovalEmail:
    def test_approval_email_returns_true(self):
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'test-id'}
            from api.services.email_service import send_merchant_approval_email
            result = send_merchant_approval_email('merchant@example.com')
            assert result is True

    def test_approval_email_returns_false_on_error(self):
        with patch('resend.Emails.send', side_effect=Exception("network error")):
            from api.services.email_service import send_merchant_approval_email
            result = send_merchant_approval_email('merchant@example.com')
            assert result is False


@pytest.mark.django_db
class TestSendMerchantRejectionEmail:
    def test_rejection_email_returns_true(self):
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'test-id'}
            from api.services.email_service import send_merchant_rejection_email
            result = send_merchant_rejection_email('merchant@example.com', reason='Incomplete docs')
            assert result is True

    def test_rejection_email_returns_false_on_error(self):
        with patch('resend.Emails.send', side_effect=Exception("send error")):
            from api.services.email_service import send_merchant_rejection_email
            result = send_merchant_rejection_email('merchant@example.com')
            assert result is False
