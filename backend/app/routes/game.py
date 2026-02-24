from __future__ import annotations

"""
Day 1 Mini Spec: Game Routes

Inputs:
- POST /game/new payload with stack/blind/seed parameters.
- POST /game/action payload with game_id/player/action/optional amount.
- GET /game/state/{game_id}.

Outputs:
- GameResponse objects wrapping current public GameState.

Rules:
- Store all games in in-memory GAMES dict (no DB on Day 1).
- Return 404 when game_id is unknown.
- Map engine validation errors to HTTP 400.

Edge cases:
- Invalid action or wrong turn returns 400.
- Missing game returns 404.

Workflow:
1. create_game -> engine.new_game -> store in GAMES -> map to response.
2. act -> load game -> engine.apply_action -> overwrite in GAMES -> response.
3. game_state -> load game -> response.
"""

from fastapi import APIRouter, HTTPException

from backend.app.schemas.game import ActionRequest, GameResponse, NewGameRequest
from engine.poker import GameState, apply_action, legal_actions, new_game

router = APIRouter(prefix="/game", tags=["game"])

GAMES: dict[str, GameState] = {}


@router.post("/new", response_model=GameResponse)
def create_game(payload: NewGameRequest) -> GameResponse:
    state = new_game(
        stack_size=payload.stack_size,
        small_blind=payload.small_blind,
        big_blind=payload.big_blind,
        seed=payload.seed,
    )
    GAMES[state.game_id] = state
    return _to_response(state)


@router.post("/action", response_model=GameResponse)
def act(payload: ActionRequest) -> GameResponse:
    state = GAMES.get(payload.game_id)
    if state is None:
        raise HTTPException(status_code=404, detail="game not found")

    try:
        updated = apply_action(
            state=state,
            player=payload.player,  # type: ignore[arg-type]
            action=payload.action,
            amount=payload.amount,
        )
    except ValueError as exc:
        # Engine uses ValueError for contract violations; translate to client error.
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    GAMES[payload.game_id] = updated
    return _to_response(updated)


@router.get("/state/{game_id}", response_model=GameResponse)
def game_state(game_id: str) -> GameResponse:
    state = GAMES.get(game_id)
    if state is None:
        raise HTTPException(status_code=404, detail="game not found")
    return _to_response(state)


def _to_response(state: GameState) -> GameResponse:
    """Single mapping path to keep API responses consistent across endpoints."""
    return GameResponse(
        game_id=state.game_id,
        street=state.street,
        pot=state.pot,
        to_act=state.to_act,
        legal_actions=legal_actions(state),
        state=state.to_public_dict(),
    )
