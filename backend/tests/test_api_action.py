from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.storage import reset_db

client = TestClient(app)


def setup_function() -> None:
    reset_db()


def _start(seed: int = 42, difficulty: str = "random") -> dict:
    return client.post(
        "/start_game",
        json={"stack_size": 1000, "small_blind": 5, "big_blind": 10, "seed": seed, "difficulty": difficulty},
    ).json()


def test_start_game_returns_new_fields() -> None:
    payload = _start()
    assert "to_act" in payload
    assert "legal_actions" in payload
    assert isinstance(payload["legal_actions"], list)
    assert len(payload["legal_actions"]) > 0
    assert "villain_hand" in payload
    assert payload["villain_hand"] == []
    assert "hero_equity" in payload
    assert payload["hero_equity"] is not None
    assert 0.0 <= payload["hero_equity"] <= 1.0
    assert "winner" in payload
    assert payload["winner"] is None


def test_action_fold_hero_villain_wins() -> None:
    game = _start()
    response = client.post("/action", json={"game_id": game["game_id"], "action": "fold"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["winner"] == "villain"


def test_action_check_both_players_act() -> None:
    game = _start()
    response = client.post("/action", json={"game_id": game["game_id"], "action": "check"})
    assert response.status_code == 200
    payload = response.json()
    assert "to_act" in payload
    assert "legal_actions" in payload


def test_action_advances_street_after_two_checks() -> None:
    """Two checks (hero + bot) should advance the street from preflop to flop."""
    game = _start(seed=7, difficulty="random")
    assert game["street"] == "preflop"

    response = client.post("/action", json={"game_id": game["game_id"], "action": "check"})
    assert response.status_code == 200
    payload = response.json()
    # After hero check + bot check, betting_history has 2 entries → advance_street fires
    assert payload["street"] == "flop"
    assert len(payload["board"]) == 3


def test_action_raises_on_unknown_game() -> None:
    response = client.post("/action", json={"game_id": "no-such-game", "action": "check"})
    assert response.status_code == 404


def test_action_invalid_action_returns_400() -> None:
    game = _start()
    response = client.post("/action", json={"game_id": game["game_id"], "action": "shove"})
    assert response.status_code == 400


def test_action_raise_adds_to_pot() -> None:
    game = _start(seed=99)
    response = client.post(
        "/action", json={"game_id": game["game_id"], "action": "raise", "amount": 50}
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pot"] >= 50


def test_showdown_reveals_villain_hand() -> None:
    """Play 8 checks (4 rounds × 2 players) to reach showdown."""
    game = _start(seed=1, difficulty="random")
    game_id = game["game_id"]
    last = game

    for _ in range(8):
        if last.get("winner") is not None:
            break
        resp = client.post("/action", json={"game_id": game_id, "action": "check"})
        assert resp.status_code == 200
        last = resp.json()

    # At showdown, villain_hand must be revealed and winner set
    assert last["street"] == "showdown" or last["winner"] is not None
    if last["street"] == "showdown":
        assert len(last["villain_hand"]) == 2
        assert last["winner"] in ("hero", "villain", "tie")
