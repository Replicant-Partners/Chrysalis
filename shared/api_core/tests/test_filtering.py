"""
Unit tests for filtering and sorting utilities.
"""

import pytest
from shared.api_core.filtering import apply_filter, apply_sorting
from shared.api_core.models import SortParams


class TestApplyFilter:
    """Tests for apply_filter function."""

    def test_equality_filter(self):
        """Test equality (eq) filter operation."""
        assert apply_filter(5, 'eq', 5) is True
        assert apply_filter(5, 'eq', 10) is False
        assert apply_filter("test", 'eq', "test") is True
        assert apply_filter("test", 'eq', "other") is False

    def test_not_equal_filter(self):
        """Test not equal (ne) filter operation."""
        assert apply_filter(5, 'ne', 10) is True
        assert apply_filter(5, 'ne', 5) is False

    def test_greater_than_filter(self):
        """Test greater than (gt) filter operation."""
        assert apply_filter(10, 'gt', 5) is True
        assert apply_filter(5, 'gt', 10) is False
        assert apply_filter(5, 'gt', 5) is False

    def test_greater_than_or_equal_filter(self):
        """Test greater than or equal (gte) filter operation."""
        assert apply_filter(10, 'gte', 5) is True
        assert apply_filter(5, 'gte', 5) is True
        assert apply_filter(3, 'gte', 5) is False

    def test_less_than_filter(self):
        """Test less than (lt) filter operation."""
        assert apply_filter(3, 'lt', 5) is True
        assert apply_filter(10, 'lt', 5) is False
        assert apply_filter(5, 'lt', 5) is False

    def test_less_than_or_equal_filter(self):
        """Test less than or equal (lte) filter operation."""
        assert apply_filter(3, 'lte', 5) is True
        assert apply_filter(5, 'lte', 5) is True
        assert apply_filter(10, 'lte', 5) is False

    def test_in_filter(self):
        """Test in (membership) filter operation."""
        assert apply_filter(3, 'in', [1, 2, 3, 4, 5]) is True
        assert apply_filter(10, 'in', [1, 2, 3, 4, 5]) is False
        assert apply_filter(3, 'in', 3) is True  # Single value treated as list
        assert apply_filter(10, 'in', 3) is False

    def test_contains_filter(self):
        """Test contains (substring) filter operation."""
        assert apply_filter("hello world", 'contains', "world") is True
        assert apply_filter("hello world", 'contains', "foo") is False
        assert apply_filter(12345, 'contains', "23") is True  # Converted to string
        assert apply_filter(None, 'contains', "test") is False

    def test_unknown_operation(self):
        """Test that unknown operations return False."""
        assert apply_filter(5, 'unknown', 10) is False

    def test_none_values(self):
        """Test filter operations with None values."""
        assert apply_filter(None, 'eq', None) is True
        assert apply_filter(None, 'eq', 5) is False
        assert apply_filter(5, 'eq', None) is False


class TestApplySorting:
    """Tests for apply_sorting function."""

    def test_empty_sort_fields(self):
        """Test that empty sort fields returns items unchanged."""
        items = [{'id': 1}, {'id': 2}, {'id': 3}]
        sort_params = SortParams(sort_fields=[])
        result = apply_sorting(items, sort_params)
        assert result == items

    def test_single_field_ascending(self):
        """Test sorting by single field in ascending order."""
        items = [
            {'id': 3, 'name': 'C'},
            {'id': 1, 'name': 'A'},
            {'id': 2, 'name': 'B'},
        ]
        sort_params = SortParams(sort_fields=['id'])
        result = apply_sorting(items, sort_params)
        assert result[0]['id'] == 1
        assert result[1]['id'] == 2
        assert result[2]['id'] == 3

    def test_single_field_descending(self):
        """Test sorting by single field in descending order."""
        items = [
            {'id': 1, 'name': 'A'},
            {'id': 3, 'name': 'C'},
            {'id': 2, 'name': 'B'},
        ]
        sort_params = SortParams(sort_fields=['-id'])
        result = apply_sorting(items, sort_params)
        assert result[0]['id'] == 3
        assert result[1]['id'] == 2
        assert result[2]['id'] == 1

    def test_multiple_fields(self):
        """Test sorting by multiple fields."""
        items = [
            {'category': 'A', 'name': 'Z'},
            {'category': 'B', 'name': 'X'},
            {'category': 'A', 'name': 'Y'},
        ]
        sort_params = SortParams(sort_fields=['category', 'name'])
        result = apply_sorting(items, sort_params)
        assert result[0]['category'] == 'A' and result[0]['name'] == 'Y'
        assert result[1]['category'] == 'A' and result[1]['name'] == 'Z'
        assert result[2]['category'] == 'B'

    def test_mixed_ascending_descending(self):
        """Test sorting with mixed ascending and descending fields."""
        items = [
            {'category': 'A', 'score': 100},
            {'category': 'A', 'score': 200},
            {'category': 'B', 'score': 100},
        ]
        sort_params = SortParams(sort_fields=['category', '-score'])
        result = apply_sorting(items, sort_params)
        assert result[0]['category'] == 'A' and result[0]['score'] == 200
        assert result[1]['category'] == 'A' and result[1]['score'] == 100
        assert result[2]['category'] == 'B'

    def test_none_values(self):
        """Test sorting with None values."""
        items = [
            {'id': 2, 'value': None},
            {'id': 1, 'value': 10},
            {'id': 3, 'value': None},
        ]
        sort_params = SortParams(sort_fields=['value', 'id'])
        result = apply_sorting(items, sort_params)
        # Items with values should come first (None sorts as (0, None), numeric as (0, value))
        assert result[0]['value'] == 10
        # None values should come after, sorted by id
        assert result[1]['id'] == 2
        assert result[2]['id'] == 3

    def test_string_values(self):
        """Test sorting with string values."""
        items = [
            {'name': 'Charlie'},
            {'name': 'Alice'},
            {'name': 'Bob'},
        ]
        sort_params = SortParams(sort_fields=['name'])
        result = apply_sorting(items, sort_params)
        assert result[0]['name'] == 'Alice'
        assert result[1]['name'] == 'Bob'
        assert result[2]['name'] == 'Charlie'

    def test_numeric_values(self):
        """Test sorting with numeric values."""
        items = [
            {'score': 100.5},
            {'score': 50.2},
            {'score': 200.0},
        ]
        sort_params = SortParams(sort_fields=['score'])
        result = apply_sorting(items, sort_params)
        assert result[0]['score'] == 50.2
        assert result[1]['score'] == 100.5
        assert result[2]['score'] == 200.0

    def test_missing_fields(self):
        """Test sorting with missing fields (treated as None)."""
        items = [
            {'id': 2},
            {'id': 1, 'name': 'A'},
            {'id': 3},
        ]
        sort_params = SortParams(sort_fields=['name', 'id'])
        result = apply_sorting(items, sort_params)
        # Item with name should come first (None sorts as (0, None), string as (0, str))
        assert result[0]['id'] == 1
        assert result[0]['name'] == 'A'
        # Items without name should be sorted by id
        assert result[1]['id'] == 2
        assert result[2]['id'] == 3
