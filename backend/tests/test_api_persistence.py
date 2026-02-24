from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.storage.db import reset_db


client = TestClient(app)


def setup_function() -> None:
    reset_db()


def test_state_is_persisted_and_retrievable() -> None:
    created = client.post(
        "/game/new",
        json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": 321},
    ).json()

    game_id = created["game_id"]

    current = client.get(f"/game/state/{game_id}")
    assert current.status_code == 200
    assert current.json()["game_id"] == game_id


def test_unknown_game_returns_404() -> None:
    missing = client.get("/game/state/does-not-exist")
    assert missing.status_code == 404
