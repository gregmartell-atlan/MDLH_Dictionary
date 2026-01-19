from app.routers import query as query_router


def test_is_query_allowed_blocks_ddl():
    sql = "SELECT 1; DROP TABLE users"
    assert query_router._is_query_allowed(sql) is False


def test_is_query_allowed_allows_select_with_literal():
    sql = "SELECT 'DROP TABLE users' AS note"
    assert query_router._is_query_allowed(sql) is True


def test_is_select_like_with_cte():
    sql = "WITH cte AS (SELECT 1) SELECT * FROM cte"
    assert query_router._is_select_like(sql) is True


def test_has_limit_ignores_comments():
    sql = "SELECT * FROM t -- LIMIT 5"
    assert query_router._has_limit(sql) is False


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows
        self._idx = 0

    def fetchmany(self, size):
        if self._idx >= len(self._rows):
            return []
        batch = self._rows[self._idx:self._idx + size]
        self._idx += size
        return batch


def test_fetch_rows_limited_caps_results():
    rows = [(1,), (2,), (3,), (4,)]
    cursor = _FakeCursor(rows)
    result = query_router._fetch_rows_limited(cursor, max_rows=3, batch_size=2)
    assert result == [[1], [2], [3]]
