from __future__ import annotations

"""
In-memory game storage.

Storage is intentionally simple at this stage: `game_store` maps `game_id` to a
JSON-safe game-state dictionary.
"""


# Maximum number of game states to hold in memory.  When the cap is reached the
# oldest entry (insertion-order first key, guaranteed by Python 3.7+ dict) is
# evicted before inserting the new one — a simple LRU-by-insertion policy.
MAX_GAMES_STORED = 1000

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
    if len(game_store) >= MAX_GAMES_STORED and game_id not in game_store:
        # Evict the oldest entry to stay within the memory cap.
        oldest = next(iter(game_store))
        del game_store[oldest]
    game_store[game_id] = state_dict


def load_game_state(game_id: str) -> dict[str, object] | None:
    return game_store.get(game_id)
