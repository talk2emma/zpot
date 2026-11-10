from rest_framework.pagination import CursorPagination


class DefaultCursorPagination(CursorPagination):
    """Cursor pagination. CursorPagination re-orders the queryset by its own ordering, so each list view declares
    `cursor_ordering` (newest first, `id` as tie-breaker). The `-id` fallback is only meaningful for integer keys."""

    page_size = 50
    max_page_size = 200
    page_size_query_param = "limit"
    ordering = "-id"

    def get_ordering(self, request, queryset, view):
        ordering = getattr(view, "cursor_ordering", None) or self.ordering
        return (ordering,) if isinstance(ordering, str) else tuple(ordering)
