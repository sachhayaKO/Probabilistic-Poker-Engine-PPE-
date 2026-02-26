from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.storage import reset_db


client = TestClient(app)


def setup_function() -> None:
    reset_db()


def test_api_smoke_game_flow() -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    created = client.post(
        "/start_game",
        json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": 123},
    )
    assert created.status_code == 200

    payload = created.json()
    assert payload["game_id"]
    assert payload["street"] == "preflop"
    assert payload["pot"] == 0
    assert payload["player_stack"] == 1000
    assert payload["bot_stack"] == 1000
    assert len(payload["player_hand"]) == 2
    assert payload["board"] == []
    assert payload["betting_history"] == []
