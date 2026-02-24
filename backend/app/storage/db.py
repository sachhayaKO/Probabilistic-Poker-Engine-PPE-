from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from backend.app.core.config import settings
from backend.app.storage.models import ActionRecord, deserialize_game_state, serialize_game_state
from engine.poker.state import GameState


def _is_sqlite() -> bool:
    return settings.database_url.startswith("sqlite:///")


def _sqlite_path() -> Path:
    return Path(settings.database_url.removeprefix("sqlite:///"))


def _postgres_dsn() -> str:
    return settings.database_url.removeprefix("postgresql+psycopg://").removeprefix("postgresql://")


def _sqlite_connect() -> sqlite3.Connection:
    path = _sqlite_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(path)


def init_db() -> None:
    if _is_sqlite():
        with _sqlite_connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS games (
                    game_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        return

    import psycopg

    with psycopg.connect(_postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS games (
                    game_id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS actions (
                    id BIGSERIAL PRIMARY KEY,
                    game_id TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )


def reset_db() -> None:
    if _is_sqlite():
        with _sqlite_connect() as conn:
            conn.execute("DROP TABLE IF EXISTS actions")
            conn.execute("DROP TABLE IF EXISTS games")
        init_db()
        return

    import psycopg

    with psycopg.connect(_postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS actions")
            cur.execute("DROP TABLE IF EXISTS games")
    init_db()


def save_game(state: GameState) -> None:
    payload = serialize_game_state(state)

    if _is_sqlite():
        with _sqlite_connect() as conn:
            conn.execute(
                """
                INSERT INTO games(game_id, payload, updated_at)
                VALUES(?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(game_id)
                DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP
                """,
                (state.game_id, json.dumps(payload)),
            )
        return

    import psycopg

    with psycopg.connect(_postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO games(game_id, payload, updated_at)
                VALUES(%s, %s::jsonb, NOW())
                ON CONFLICT(game_id)
                DO UPDATE SET payload=excluded.payload, updated_at=NOW()
                """,
                (state.game_id, json.dumps(payload)),
            )


def load_game(game_id: str) -> GameState | None:
    if _is_sqlite():
        with _sqlite_connect() as conn:
            row = conn.execute("SELECT payload FROM games WHERE game_id = ?", (game_id,)).fetchone()
        if row is None:
            return None
        return deserialize_game_state(json.loads(row[0]))

    import psycopg

    with psycopg.connect(_postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM games WHERE game_id = %s", (game_id,))
            row = cur.fetchone()
    if row is None:
        return None
    return deserialize_game_state(row[0])


def save_action(record: ActionRecord) -> None:
    payload = json.dumps(record.__dict__)

    if _is_sqlite():
        with _sqlite_connect() as conn:
            conn.execute(
                "INSERT INTO actions(game_id, payload) VALUES(?, ?)",
                (record.game_id, payload),
            )
        return

    import psycopg

    with psycopg.connect(_postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO actions(game_id, payload) VALUES(%s, %s::jsonb)",
                (record.game_id, payload),
            )


def list_actions(game_id: str) -> list[dict[str, object]]:
    if _is_sqlite():
        with _sqlite_connect() as conn:
            rows = conn.execute("SELECT payload FROM actions WHERE game_id = ?", (game_id,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    import psycopg

    with psycopg.connect(_postgres_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM actions WHERE game_id = %s", (game_id,))
            rows = cur.fetchall()
    return [row[0] if isinstance(row[0], dict) else json.loads(row[0]) for row in rows]
