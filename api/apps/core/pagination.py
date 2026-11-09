from rest_framework.pagination import CursorPagination


class DefaultCursorPagination(CursorPagination):
    page_size = 50
    max_page_size = 200
    page_size_query_param = "limit"
    ordering = "-id"
