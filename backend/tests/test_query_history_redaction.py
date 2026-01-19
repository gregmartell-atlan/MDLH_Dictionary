from app.database import QueryHistoryDB


def test_redact_sql_literals():
    sql = "SELECT * FROM users WHERE email='a@b.com' AND name='O''Brien'"
    redacted = QueryHistoryDB._redact_sql(sql)
    assert "a@b.com" not in redacted
    assert "O''Brien" not in redacted
    assert redacted.count("'***'") == 2
