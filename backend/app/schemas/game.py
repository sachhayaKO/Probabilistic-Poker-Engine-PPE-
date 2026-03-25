from __future__ import annotations

"""
API schemas for game creation and state responses.

These models lock request/response shapes so frontend integrations can rely on a
stable payload contract.
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Street = Literal["preflop", "flop", "turn", "river", "showdown"]


class StartGameRequest(BaseModel):
    stack_size: int = Field(default=1000, gt=0)
    small_blind: int = Field(default=5, gt=0)
    big_blind: int = Field(default=10, gt=0)
    seed: int | None = None

    @model_validator(mode="after")
    def big_blind_must_exceed_small_blind(self) -> "StartGameRequest":
        if self.big_blind < self.small_blind:
            raise ValueError("big_blind must be >= small_blind")
        return self


class GameStateResponse(BaseModel):
    game_id: str
    street: Street
    pot: int
    player_stack: int
    bot_stack: int
    player_hand: list[str]
    board: list[str]
    betting_history: list[dict[str, object]]
