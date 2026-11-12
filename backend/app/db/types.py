"""MySQL-friendly column types shared by the models and the Alembic migration.

* ``UTCDateTime``  - MySQL ``DATETIME(6)`` has no time zone, so values are stored as naive UTC and returned as
  timezone-aware UTC datetimes. Microsecond precision keeps message ordering (user question -> answer) exact.
* ``LongText``     - ``MEDIUMTEXT`` on MySQL (plain ``TEXT`` is capped at 64 KB).
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Text, TypeDecorator, text
from sqlalchemy.dialects import mysql

# Server-side default used when a row is inserted by raw SQL (the ORM sets the value itself via ``utcnow``).
NOW6 = text("CURRENT_TIMESTAMP(6)")

LongText = Text().with_variant(mysql.MEDIUMTEXT(), "mysql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Timezone-aware UTC datetimes on top of MySQL's naive ``DATETIME(6)``."""

    impl = DateTime
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "mysql":
            return dialect.type_descriptor(mysql.DATETIME(fsp=6))
        return dialect.type_descriptor(DateTime())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)
