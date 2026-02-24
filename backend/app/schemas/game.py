from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Player = Literal["hero", "villain"]
Action = Literal["fold", "check", "call", "raise"]
Street = Literal["preflop", "flop", "turn", "river", "showdown"]


class NewGameRequest(BaseModel):
    stack_size: int = Field(default=1000, gt=0)
    small_blind: int = Field(default=5, gt=0)
    big_blind: int = Field(default=10, gt=0)
    seed: int | None = None


class ActionRequest(BaseModel):
    game_id: str
    player: Player
    action: Action
    amount: int | None = Field(default=None, gt=0)


class GameResponse(BaseModel):
    game_id: str
    street: Street
    pot: int
    to_act: Player
    legal_actions: list[Action]
    state: dict[str, object]
