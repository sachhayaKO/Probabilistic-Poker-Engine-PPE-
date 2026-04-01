from __future__ import annotations

"""
Betting round utilities for heads-up Texas Hold'em.

These pure functions compute betting obligations and legal actions from the
existing GameState, using only the data already tracked by the engine
(pot, stacks, betting_history).  They are decoupled from game.py so they
can be composed, tested, and later wired in as a replacement for the
current placeholder logic.
"""

from engine.poker.state import GameState


def _street_actions(state: GameState) -> list[dict[str, object]]:
    """Return betting_history entries that belong to the current street.

    The history is partitioned by the fact that each new street starts
    immediately after every previous street's last action.  Since the
    placeholder engine advances the street every two actions, we find the
    last street-change boundary by scanning backwards for actions from
    both players.
    """
    history = state.betting_history
    if not history:
        return []

    # Walk backwards, collect entries until we've seen both players switch
    # or we hit the beginning of the list.  Because we only need same-street
    # context we stop as soon as we collect a pair of alternating entries
    # that sums to a complete round (both hero + villain have acted once).
    # Simple heuristic that works with the current alternating-action model:
    # the current street's actions are the tail whose length equals
    # (len(history) % 2) or 2, whichever is nonzero.
    tail_len = len(history) % 2
    if tail_len == 0:
        # Street just ended; no pending actions for the *next* street yet.
        return []
    return list(history[-tail_len:])


def amount_invested(history: list[dict[str, object]], player: str) -> int:
    """Sum the chips a player has put in over the given history slice."""
    total = 0
    for record in history:
        if record.get("player") == player:
            amt = record.get("amount")
            if isinstance(amt, int):
                total += amt
    return total


def call_amount(state: GameState, player: str) -> int:
    """Chips the acting player must add to the pot to call.

    Compares the two players' investments in the current street.  Returns
    0 when the action is already equalized (check situation).
    """
    street = _street_actions(state)
    opponent = "villain" if player == "hero" else "hero"
    hero_in = amount_invested(street, player)
    opp_in = amount_invested(street, opponent)
    return max(0, opp_in - hero_in)


def min_raise_amount(state: GameState, big_blind: int) -> int:
    """Minimum legal raise size (the raise *increment*, not the total bet).

    Standard no-limit rule: the raise must be at least the size of the
    most recent raise increment, or one big blind if no prior raise exists.
    """
    last_raise = 0
    for record in reversed(state.betting_history):
        if record.get("action") == "raise":
            amt = record.get("amount")
            if isinstance(amt, int):
                last_raise = amt
                break
    return max(last_raise, big_blind)


def legal_actions(state: GameState, big_blind: int = 10) -> list[str]:
    """Return the precise set of legal actions for the acting player.

    Unlike the placeholder in game.py this respects stack sizes:
    - fold is always available unless the player is all-in.
    - check is available when there is nothing to call.
    - call is available when there is an outstanding bet and the player
      has chips to contribute.
    - raise is available when the player has chips above the call amount.
    """
    if state.street == "showdown":
        return []

    player = state.to_act
    stack = state.stacks.get(player, 0)
    to_call = call_amount(state, player)
    actions: list[str] = []

    if stack > 0:
        actions.append("fold")

    if to_call == 0:
        actions.append("check")
    elif stack > 0:
        actions.append("call")

    min_r = min_raise_amount(state, big_blind)
    if stack > to_call + min_r:
        actions.append("raise")

    if not actions:
        # Edge case: stack is exactly 0 — only legal move is check/fold.
        actions.append("check")

    return actions
