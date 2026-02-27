from __future__ import annotations

"""
In-memory game storage.

Storage is intentionally simple at this stage: `game_store` maps `game_id` to a
JSON-safe game-state dictionary.
"""


game_store: dict[str, dict[str, object]] = {}


def init_db() -> None:
    """Compatibility hook for app startup."""
    return


def reset_db() -> None:
    """Clear all in-memory state for test isolation."""
    game_store.clear()


def save_game_state(state_dict: dict[str, object]) -> None:
    game_id = state_dict.get("game_id")
    if not isinstance(game_id, str) or not game_id:
        raise ValueError("state_dict must include non-empty game_id")
    game_store[game_id] = state_dict


def load_game_state(game_id: str) -> dict[str, object] | None:
    return game_store.get(game_id)
