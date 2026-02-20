from __future__ import annotations

"""
Day 1 Mini Spec: API Schemas

Inputs:
- New game and action request JSON payloads.

Outputs:
- Pydantic-validated request objects and serialized response objects.

Rules:
- stack/blind fields must be positive.
- action amount is optional but, if present, must be positive.

Workflow:
1. FastAPI validates incoming payloads with these models.
2. Route handlers pass validated values into engine functions.
3. Route handlers return GameResponse for stable client contract.
"""

from pydantic import BaseModel, Field


class NewGameRequest(BaseModel):
    stack_size: int = Field(default=1000, gt=0)
    small_blind: int = Field(default=5, gt=0)
    big_blind: int = Field(default=10, gt=0)
    seed: int | None = None


class ActionRequest(BaseModel):
    game_id: str
    player: str
    action: str
    amount: int | None = Field(default=None, gt=0)


class GameResponse(BaseModel):
    game_id: str
    street: str
    pot: int
    to_act: str
    legal_actions: list[str]
    state: dict[str, object]
