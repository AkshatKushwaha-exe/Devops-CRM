"""Apply or await Alembic migrations explicitly, before the API serves traffic.

python -m app.migrate upgrade   # one-shot migration step (Compose service, Kubernetes Job)
python -m app.migrate wait      # block until the schema is ready (API init container)

A database that is *ahead* of this image (a newer revision this image does not know) is
accepted, so rolling back to an older image keeps working. Schema changes must therefore stay
backward compatible for one release (expand, then contract).
"""

import argparse
import sys
import time
from enum import Enum
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import Connection, text
from sqlalchemy.exc import OperationalError

from alembic import command
from app.db import engine

# Arbitrary application-wide key so concurrent migration runs serialize on PostgreSQL.
ADVISORY_LOCK_KEY = 72_410_001


class SchemaState(Enum):
    PENDING = "pending"
    CURRENT = "current"
    AHEAD = "ahead"


def alembic_config() -> Config:
    return Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))


def schema_state(connection: Connection, config: Config) -> SchemaState:
    script = ScriptDirectory.from_config(config)
    current = MigrationContext.configure(connection).get_current_heads()
    if script.get_current_head() in current:
        return SchemaState.CURRENT
    for revision in current:
        try:
            script.get_revision(revision)
        except CommandError:
            return SchemaState.AHEAD
    return SchemaState.PENDING


def wait_for_database(timeout: float) -> None:
    deadline = time.monotonic() + timeout
    while True:
        try:
            with engine.connect():
                return
        except OperationalError as error:
            if time.monotonic() >= deadline:
                raise SystemExit(f"Database unreachable after {timeout:.0f}s: {error.orig}")
            print("Waiting for the database…", flush=True)
            time.sleep(2)


def upgrade(timeout: float) -> SchemaState:
    wait_for_database(timeout)
    config = alembic_config()
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(
                text("SELECT pg_advisory_xact_lock(:key)"), {"key": ADVISORY_LOCK_KEY}
            )
        state = schema_state(connection, config)
        if state is SchemaState.PENDING:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
    return state


def wait(timeout: float, interval: float = 2) -> SchemaState:
    wait_for_database(timeout)
    config = alembic_config()
    deadline = time.monotonic() + timeout
    while True:
        with engine.connect() as connection:
            state = schema_state(connection, config)
        if state is not SchemaState.PENDING:
            return state
        if time.monotonic() >= deadline:
            raise SystemExit(f"Schema still pending after {timeout:.0f}s; check the migration job.")
        print("Waiting for migrations to be applied…", flush=True)
        time.sleep(interval)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("action", choices=["upgrade", "wait"])
    parser.add_argument("--timeout", type=float, default=300, help="seconds (default 300)")
    args = parser.parse_args(argv)
    state = upgrade(args.timeout) if args.action == "upgrade" else wait(args.timeout)
    messages = {
        SchemaState.PENDING: "Migrations applied; schema is at head.",
        SchemaState.CURRENT: "Schema is already at head.",
        SchemaState.AHEAD: "Database is ahead of this image (rollback); leaving schema unchanged.",
    }
    print(messages[state], flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
