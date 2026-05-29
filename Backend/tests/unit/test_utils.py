"""Unit tests for api/utils.py — phone validation, masking, code generation, display helpers."""
import pytest
from api.utils import (
    validate_phone_number,
    mask_phone_number,
    generate_unified_redemption_code,
    display_face_value,
    get_store_currency_code,
)


class TestPhoneValidation:
    def test_valid_taiwan_mobile_returns_normalized(self):
        assert validate_phone_number('0912345678') == '0912345678'

    def test_valid_with_spaces_normalizes(self):
        assert validate_phone_number('09 1234 5678') == '0912345678'

    def test_valid_with_dashes_normalizes(self):
        assert validate_phone_number('09-1234-5678') == '0912345678'

    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match='empty'):
            validate_phone_number('')

    def test_none_raises(self):
        with pytest.raises((ValueError, TypeError)):
            validate_phone_number(None)

    def test_invalid_prefix_raises(self):
        with pytest.raises(ValueError, match='Invalid phone number format'):
            validate_phone_number('0812345678')

    def test_too_short_raises(self):
        with pytest.raises(ValueError):
            validate_phone_number('091234567')

    def test_too_long_raises(self):
        with pytest.raises(ValueError):
            validate_phone_number('09123456789')

    def test_non_numeric_raises(self):
        with pytest.raises(ValueError):
            validate_phone_number('091234567a')

    def test_non_taiwan_format_raises(self):
        with pytest.raises(ValueError):
            validate_phone_number('1234567890')


class TestMaskPhone:
    def test_masks_middle_digits(self):
        masked = mask_phone_number('0912345678')
        assert masked == '0912****78'

    def test_short_string_returned_unchanged(self):
        assert mask_phone_number('12345') == '12345'

    def test_empty_returned_unchanged(self):
        assert mask_phone_number('') == ''

    def test_mask_preserves_first_four(self):
        result = mask_phone_number('0912345678')
        assert result.startswith('0912')

    def test_mask_preserves_last_two(self):
        result = mask_phone_number('0912345678')
        assert result.endswith('78')


class TestGenerateUnifiedRedemptionCode:
    def test_returns_six_digit_string(self):
        code = generate_unified_redemption_code()
        assert len(code) == 6

    def test_all_digits(self):
        code = generate_unified_redemption_code()
        assert code.isdigit(), f'expected all digits, got {code!r}'

    def test_multiple_calls_produce_valid_codes(self):
        for _ in range(10):
            code = generate_unified_redemption_code()
            assert len(code) == 6
            assert code.isdigit()


class TestDisplayFaceValue:
    def test_integer_float_returns_int(self):
        assert display_face_value(10.0) == 10
        assert isinstance(display_face_value(10.0), int)

    def test_fractional_float_returns_float(self):
        result = display_face_value(10.5)
        assert result == 10.5

    def test_none_returns_zero(self):
        assert display_face_value(None) == 0

    def test_integer_input_returns_int(self):
        assert display_face_value(5) == 5

    def test_zero_returns_zero(self):
        assert display_face_value(0) == 0


class TestGetStoreCurrencyCode:
    def test_returns_none_for_object_without_attribute(self):
        class Obj:
            pass
        assert get_store_currency_code(Obj()) is None

    def test_returns_code_when_present(self):
        class Obj:
            currency_code = 'TWD'
        assert get_store_currency_code(Obj()) == 'TWD'

    def test_returns_none_for_empty_string(self):
        class Obj:
            currency_code = ''
        assert get_store_currency_code(Obj()) is None
