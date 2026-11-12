"""Check the MySQL connection and show the database status.

Usage:  python -m app.scripts.check_db
"""
import sys

from sqlalchemy import inspect, text

from app.db.session import engine


def main() -> int:
    try:
        with engine.connect() as conn:
            version = conn.scalar(text("SELECT VERSION()"))
            db_name = conn.scalar(text("SELECT DATABASE()"))
            charset, collation = conn.execute(text("SELECT @@character_set_database, @@collation_database")).one()
            tz = conn.scalar(text("SELECT @@session.time_zone"))
            isolation = conn.scalar(text("SELECT @@transaction_isolation"))
            print(f"Connected to MySQL {version}, database '{db_name}'")
            print(f"  charset={charset} collation={collation} session_time_zone={tz} isolation={isolation}")
            if not str(charset).startswith("utf8mb4"):
                print("  WARNING: the database is not utf8mb4 - emoji/Hindi text may fail. Recreate it with "
                      "CHARACTER SET utf8mb4 (see database/init.sql).")
            tables = inspect(engine).get_table_names()
            if "alembic_version" not in tables:
                print("  Tables are missing. Run:  alembic upgrade head")
                return 1
            print("  Tables:")
            for t in sorted(tables):
                print(f"    {t:<20} {conn.scalar(text(f'SELECT COUNT(*) FROM `{t}`'))} rows")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Database check FAILED: {exc.__class__.__name__}: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
