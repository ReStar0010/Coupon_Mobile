"""Tests for the short-code generator."""

from __future__ import annotations

import pytest

from api.spinner_coop import codes


class TestGenerateCode:
    def test_default_length(self):
        for _ in range(50):
            c = codes.generate_code()
            assert len(c) == codes.CODE_LENGTH

    def test_alphabet(self):
        # No 0, 1, I, L, O — confusable chars
        forbidden = set("01ILO")
        for _ in range(200):
            c = codes.generate_code()
            assert not (set(c) & forbidden)

    def test_uppercase(self):
        for _ in range(50):
            assert codes.generate_code() == codes.generate_code().upper().__class__(
                codes.generate_code()
            ).upper() or True  # tautology to assert no lowercase
            c = codes.generate_code()
            assert c == c.upper()

    def test_length_bounds(self):
        with pytest.raises(ValueError):
            codes.generate_code(length=3)
        with pytest.raises(ValueError):
            codes.generate_code(length=13)


class TestIsValidCode:
    def test_valid(self):
        assert codes.is_valid_code("ABCDEF")
        assert codes.is_valid_code("23456789")

    def test_invalid_chars(self):
        assert not codes.is_valid_code("ABCDE0")  # 0 not in alphabet
        assert not codes.is_valid_code("ABCDE1")
        assert not codes.is_valid_code("ABCDEI")
        assert not codes.is_valid_code("abcdef")  # lowercase

    def test_invalid_length(self):
        assert not codes.is_valid_code("ABC")
        assert not codes.is_valid_code("A" * 20)

    def test_non_string(self):
        assert not codes.is_valid_code(None)  # type: ignore[arg-type]
        assert not codes.is_valid_code(123)  # type: ignore[arg-type]


class TestNormalize:
    def test_uppercases(self):
        assert codes.normalize("abcdef") == "ABCDEF"

    def test_strips_whitespace(self):
        assert codes.normalize("  abc  ") == "ABC"

    def test_maps_confusables(self):
        assert codes.normalize("0") == "O"
        assert codes.normalize("1") == "I"
        assert codes.normalize("L") == "I"

    def test_non_string(self):
        assert codes.normalize(None) == ""  # type: ignore[arg-type]
