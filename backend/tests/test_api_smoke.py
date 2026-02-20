from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_api_smoke_game_flow() -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    new_game = client.post(
        "/game/new",
        json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": 123},
    )
    assert new_game.status_code == 200
    created = new_game.json()
    assert created["game_id"]
    assert created["street"] == "preflop"
    assert "legal_actions" in created

    game_id = created["game_id"]
    to_act = created["to_act"]

    action = client.post(
        "/game/action",
        json={"game_id": game_id, "player": to_act, "action": "check"},
    )
    assert action.status_code == 200
    acted = action.json()
    assert acted["game_id"] == game_id
    assert "legal_actions" in acted
    assert acted["to_act"] in {"hero", "villain"}
