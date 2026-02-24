from __future__ import annotations

"""
Day 2 Mini Spec: Engine Street + Dealing Flow

Inputs:
- new_game(starting_stack, small_blind, big_blind, seed)
- apply_action(state, player, action, amount=None)
- advance_street(state, burn_card=True)

Outputs:
- GameState objects with real community-card dealing progression.

Rules:
- Supported players: hero, villain.
- Supported actions: fold, check, call, raise.
- Raise requires positive amount.
- Street flow:
  - preflop -> flop (3 board cards)
  - flop -> turn (1 board card)
  - turn -> river (1 board card)
  - river -> showdown (no dealing)

Edge cases:
- Invalid action/player/turn/raise amount raises ValueError.
- Advancing from showdown keeps showdown unchanged.
- Insufficient deck cards raises ValueError via deck.deal/burn.

Workflow:
1. new_game creates/reset/shuffles deck and deals 2+2 hole cards.
2. advance_street deals community cards according to current street.
3. apply_action remains placeholder betting glue and can trigger street advance.
"""

import uuid

from engine.poker.cards import Deck
from engine.poker.state import GameState, Player, Street

VALID_ACTIONS = {"fold", "check", "call", "raise"}


def new_game(
    starting_stack: int = 1000,
    small_blind: int = 5,
    big_blind: int = 10,
    seed: int | None = None,
    stack_size: int | None = None,
) -> GameState:
    """
    Create fresh preflop state and deal 2 hole cards per player.

    `stack_size` is kept as a compatibility alias for existing backend calls.
    """
    if stack_size is not None:
        starting_stack = stack_size

    deck = Deck()
    deck.shuffle(seed=seed)

    hero_hand = deck.deal(2)
    villain_hand = deck.deal(2)

    return GameState(
        game_id=str(uuid.uuid4()),
        seed=seed,
        street="preflop",
        # Day 2 keeps pot simple; blinds can be modeled in betting engine later.
        pot=0,
        stacks={"hero": starting_stack, "villain": starting_stack},
        hands={"hero": hero_hand, "villain": villain_hand},
        board=[],
        deck=deck,
        to_act="hero",
        betting_history=[],
    )


def advance_street(state: GameState, burn_card: bool = True) -> GameState:
    """Advance one street and deal community cards following Hold'em rules."""
    if state.street == "showdown":
        return state

    if state.street == "preflop":
        if burn_card:
            state.deck.burn(1)
        state.board.extend(state.deck.deal(3))
        state.street = "flop"
        return state

    if state.street == "flop":
        if burn_card:
            state.deck.burn(1)
        state.board.extend(state.deck.deal(1))
        state.street = "turn"
        return state

    if state.street == "turn":
        if burn_card:
            state.deck.burn(1)
        state.board.extend(state.deck.deal(1))
        state.street = "river"
        return state

    state.street = "showdown"
    return state


def apply_action(
    state: GameState,
    player: Player,
    action: str,
    amount: int | None = None,
) -> GameState:
    """Apply a validated placeholder action and advance turns/streets minimally."""
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
        # Placeholder betting model: amount contributes directly to pot.
        state.pot += amount
        state.stacks[player] = max(0, state.stacks[player] - amount)

    state.to_act = "villain" if player == "hero" else "hero"

    # Placeholder progression until betting rounds are fully implemented.
    if len(state.betting_history) % 2 == 0:
        advance_street(state)

    return state


def legal_actions(state: GameState) -> list[str]:
    """Return current legal actions while betting engine is still placeholder."""
    if state.street == "showdown":
        return []
    return ["fold", "check", "call", "raise"]
