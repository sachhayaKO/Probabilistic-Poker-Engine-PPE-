from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.storage import reset_db


client = TestClient(app)


def setup_function() -> None:
    reset_db()


def test_state_is_persisted_and_retrievable() -> None:
    created = client.post(
        "/start_game",
        json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": 321},
    ).json()

    game_id = created["game_id"]

    current = client.get(f"/game_state/{game_id}")
    assert current.status_code == 200
    response = current.json()
    assert response["game_id"] == game_id
    assert response["street"] == "preflop"
    assert response["board"] == []


def test_three_games_are_isolated_in_store() -> None:
    game_ids: list[str] = []

    for seed in [11, 22, 33]:
        created = client.post(
            "/start_game",
            json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": seed},
        )
        assert created.status_code == 200
        game_ids.append(created.json()["game_id"])

    for game_id in game_ids:
        response = client.get(f"/game_state/{game_id}")
        assert response.status_code == 200
        assert response.json()["game_id"] == game_id


def test_unknown_game_returns_404() -> None:
    missing = client.get("/game_state/does-not-exist")
    assert missing.status_code == 404
