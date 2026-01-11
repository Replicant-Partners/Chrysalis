"""
Helper functions for list endpoints with filtering, sorting, and pagination.

Provides reusable logic for common list endpoint patterns.
"""

from typing import List, Dict, Any, Optional, Callable
from .models import PaginationParams, PaginationMeta, FilterParams, SortParams
from .filtering import apply_filter, apply_sorting

try:
    from flask import request as flask_request
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    flask_request = None


def apply_list_filters(
    items: List[Dict[str, Any]],
    filters: FilterParams
) -> List[Dict[str, Any]]:
    """
    Apply filter parameters to a list of items.

    Args:
        items: List of dictionaries to filter
        filters: FilterParams object with filter criteria

    Returns:
        Filtered list of items

    Filter Format:
        - Simple equality: filter[field]=value
        - Operators: filter[field][op]=value (eq, ne, gt, gte, lt, lte, in, contains)
    """
    if not filters.filters:
        return items

    filtered_items = items
    for field, value in filters.filters.items():
        if isinstance(value, dict):
            # Handle filter[field][op] format
            for op, op_value in value.items():
                filtered_items = [
                    item for item in filtered_items
                    if apply_filter(item.get(field), op, op_value)
                ]
        else:
            # Simple equality filter
            filtered_items = [
                item for item in filtered_items
                if item.get(field) == value
            ]

    return filtered_items


def process_list_items(
    items: List[Dict[str, Any]],
    pagination: Optional[PaginationParams] = None,
    filters: Optional[FilterParams] = None,
    sort_params: Optional[SortParams] = None
) -> tuple[List[Dict[str, Any]], PaginationMeta]:
    """
    Process a list of items with filtering, sorting, and pagination.

    This is a lower-level helper that operates on already-extracted parameters.
    For Flask endpoints, use `process_list_request` instead.

    Args:
        items: List of dictionaries to process
        pagination: Pagination parameters (default: first page, 20 items)
        filters: Filter parameters
        sort_params: Sort parameters
    Returns:
        Tuple of (paginated items list, PaginationMeta)

    Example:
        items = [{'id': 1, 'name': 'A'}, {'id': 2, 'name': 'B'}]
        pagination = PaginationParams(page=1, per_page=10)
        filters = FilterParams(filters={'name': 'A'})
        sort_params = SortParams(sort_fields=['id'])

        paginated_items, meta = process_list_items(
            items, pagination, filters, sort_params
        )
    """
    # Apply filters
    if filters:
        items = apply_list_filters(items, filters)

    # Apply sorting
    if sort_params and sort_params.sort_fields:
        items = apply_sorting(items, sort_params)

    total = len(items)

    # Apply pagination
    if pagination:
        start = pagination.offset
        end = start + pagination.per_page
        paginated_items = items[start:end]
        pagination_meta = PaginationMeta.create(pagination, total)
    else:
        # No pagination - return all items
        paginated_items = items
        pagination_meta = PaginationMeta.create(
            PaginationParams(page=1, per_page=total),
            total
        )

    return paginated_items, pagination_meta


def process_list_request(
    items: List[Dict[str, Any]],
    request_obj=None
) -> tuple[List[Dict[str, Any]], PaginationMeta]:
    """
    Process a list request with filtering, sorting, and pagination.

    Extracts pagination, filter, and sort parameters from Flask request
    and applies them to the items list.

    This is the high-level helper for Flask endpoints.

    Args:
        items: List of dictionaries to process
        request_obj: Flask request object (default: uses flask.request)

    Returns:
        Tuple of (paginated items list, PaginationMeta)

    Raises:
        RuntimeError: If Flask is not available

    Example:
        @app.route('/api/v1/agents', methods=['GET'])
        @require_auth
        def list_agents():
            all_agents = list(agents_store.values())
            agents_page, pagination_meta = process_list_request(all_agents)
            return json_response(agents_page, pagination=pagination_meta)
    """
    if not FLASK_AVAILABLE:
        raise RuntimeError("Flask is required for process_list_request. Install Flask.")

    if request_obj is None:
        request_obj = flask_request

    # Extract parameters from request
    pagination = PaginationParams.from_request(request_obj)
    filters = FilterParams.from_request(request_obj)
    sort_params = SortParams.from_request(request_obj)

    return process_list_items(items, pagination, filters, sort_params)
