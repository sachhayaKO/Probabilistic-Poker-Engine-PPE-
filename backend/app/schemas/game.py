from __future__ import annotations

"""
API schemas for game creation and state responses.
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Street = Literal["preflop", "flop", "turn", "river", "showdown"]


class StartGameRequest(BaseModel):
    stack_size: int = Field(default=1000, gt=0)
    small_blind: int = Field(default=5, gt=0)
    big_blind: int = Field(default=10, gt=0)
    seed: int | None = None
    difficulty: Literal["random", "cheat", "ppo"] = "random"

    @model_validator(mode="after")
    def big_blind_must_exceed_small_blind(self) -> "StartGameRequest":
        if self.big_blind < self.small_blind:
            raise ValueError("big_blind must be >= small_blind")
        return self


class ActionRequest(BaseModel):
    game_id: str
    player: Literal["hero"] = "hero"
    action: Literal["fold", "check", "call", "raise"]
    amount: int | None = None


class GameStateResponse(BaseModel):
    game_id: str
    street: Street
    pot: int
    player_stack: int
    bot_stack: int
    player_hand: list[str]
    villain_hand: list[str] = []
    board: list[str]
    betting_history: list[dict[str, object]]
    to_act: Literal["hero", "villain"] = "hero"
    legal_actions: list[str] = []
    hero_equity: float | None = None
    winner: str | None = None
