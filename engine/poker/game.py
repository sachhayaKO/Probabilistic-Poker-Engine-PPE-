from __future__ import annotations

"""
Day 1 Mini Spec: Engine Orchestration Stubs

Inputs:
- new_game(stack_size, small_blind, big_blind, seed)
- apply_action(state, player, action, amount=None)

Outputs:
- GameState objects with stable API shape for backend integration.

Rules:
- Supported players: hero, villain.
- Supported actions: fold, check, call, raise.
- Raise requires positive amount.
- Betting logic is placeholder-only for Day 1 (no full NLHE engine yet).

Edge cases:
- Invalid action/player/turn/raise amount raises ValueError.
- showdown returns no legal actions.

Workflow:
1. new_game creates seeded deck, deals hole cards, initializes blinds/pot.
2. apply_action validates input and appends to betting_history.
3. apply_action toggles turn and uses simple street progression placeholder.
"""

import uuid

from engine.poker.cards import Deck
from engine.poker.state import GameState, Player, Street

VALID_ACTIONS = {"fold", "check", "call", "raise"}
STREET_ORDER: list[Street] = ["preflop", "flop", "turn", "river", "showdown"]


def new_game(
    stack_size: int,
    small_blind: int,
    big_blind: int,
    seed: int | None = None,
) -> GameState:
    """Create initial Day 1 game state with deterministic dealing support."""
    deck = Deck(seed=seed)
    deck.shuffle()

    hero_hand = deck.deal(2)
    villain_hand = deck.deal(2)

    pot = small_blind + big_blind
    return GameState(
        game_id=str(uuid.uuid4()),
        seed=seed,
        street="preflop",
        pot=pot,
        stacks={"hero": stack_size - small_blind, "villain": stack_size - big_blind},
        hands={"hero": hero_hand, "villain": villain_hand},
        board=[],
        to_act="hero",
        betting_history=[],
    )


def apply_action(
    state: GameState,
    player: Player,
    action: str,
    amount: int | None = None,
) -> GameState:
    """Apply a validated Day 1 action and perform placeholder state transition."""
    if action not in VALID_ACTIONS:
        raise ValueError(f"invalid action: {action}")
    if player not in {"hero", "villain"}:
        raise ValueError(f"invalid player: {player}")
    if player != state.to_act:
        raise ValueError(f"not {player}'s turn")
    if action == "raise" and (amount is None or amount <= 0):
        raise ValueError("raise action requires positive amount")

    action_record = {"player": player, "action": action}
    if amount is not None:
        action_record["amount"] = amount
    state.betting_history.append(action_record)

    if amount:
        # Day 1 simplification: amount always contributes directly to pot.
        state.pot += amount
        state.stacks[player] = max(0, state.stacks[player] - amount)

    state.to_act = "villain" if player == "hero" else "hero"

    # Placeholder transition: advance one street after each pair of actions.
    if len(state.betting_history) % 2 == 0:
        idx = STREET_ORDER.index(state.street)
        if idx < len(STREET_ORDER) - 1:
            state.street = STREET_ORDER[idx + 1]

    return state


def legal_actions(state: GameState) -> list[str]:
    """Return current legal actions for Day 1 contract surface."""
    if state.street == "showdown":
        return []
    return ["fold", "check", "call", "raise"]
