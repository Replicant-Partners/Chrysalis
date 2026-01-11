"""
Filtering and sorting utilities for API endpoints.

Provides reusable functions for applying filters and sorting to data collections.
"""

from typing import Any, Dict, List
from .models import SortParams


def apply_filter(value: Any, op: str, op_value: Any) -> bool:
    """
    Apply filter operation to a value.

    Args:
        value: The value to filter
        op: Filter operation (eq, ne, gt, gte, lt, lte, in, contains)
        op_value: The value to compare against

    Returns:
        True if the filter condition is met, False otherwise

    Supported Operations:
        - eq: Equality (value == op_value)
        - ne: Not equal (value != op_value)
        - gt: Greater than (value > op_value)
        - gte: Greater than or equal (value >= op_value)
        - lt: Less than (value < op_value)
        - lte: Less than or equal (value <= op_value)
        - in: Membership (value in op_value or [op_value])
        - contains: Substring search (op_value in str(value))
    """
    if op == 'eq':
        return value == op_value
    elif op == 'ne':
        return value != op_value
    elif op == 'gt':
        return value > op_value
    elif op == 'gte':
        return value >= op_value
    elif op == 'lt':
        return value < op_value
    elif op == 'lte':
        return value <= op_value
    elif op == 'in':
        return value in (op_value if isinstance(op_value, list) else [op_value])
    elif op == 'contains':
        return op_value in str(value)
    return False


def apply_sorting(items: List[Dict[str, Any]], sort_params: SortParams) -> List[Dict[str, Any]]:
    """
    Apply sorting to a list of items based on SortParams.

    Args:
        items: List of dictionaries to sort
        sort_params: SortParams object with sort fields

    Returns:
        Sorted list of items

    Sort Field Format:
        - Field name: ascending order (e.g., "name")
        - Prefixed with "-": descending order (e.g., "-created_at")
        - Multiple fields: comma-separated (e.g., "-created_at,name")
    """
    if not sort_params.sort_fields:
        return items

    def sort_key(item: Dict[str, Any]) -> tuple:
        """Generate sort key tuple from item."""
        keys = []
        for field in sort_params.sort_fields:
            # Handle descending order (field starts with -)
            if field.startswith('-'):
                field_name = field[1:]
                reverse = True
            else:
                field_name = field
                reverse = False

            value = item.get(field_name)
            # Handle None values and different types
            # All sort values must be tuples for consistent comparison
            # None values: use (1, None) for ascending (pushes to end), (0, None) for descending (pushes to start)
            if value is None:
                sort_val = (0, None) if reverse else (1, None)
            elif isinstance(value, (int, float)):
                sort_val = (1, -value) if reverse else (0, value)
            else:
                sort_val = (1, str(value)) if reverse else (0, str(value))
            keys.append(sort_val)
        return tuple(keys)

    return sorted(items, key=sort_key)
