from __future__ import annotations

import json

from engine.poker import Card, Deck, advance_street, new_game


def test_card_roundtrip() -> None:
    card = Card.from_str("Ah")
    assert str(card) == "Ah"


def test_deck_has_52_unique_cards() -> None:
    deck = Deck()
    all_cards = [str(card) for card in deck.cards]
    assert len(all_cards) == 52
    assert len(set(all_cards)) == 52


def test_deal_reduces_deck_size() -> None:
    deck = Deck()
    before = len(deck.cards)
    dealt = deck.deal(5)
    after = len(deck.cards)

    assert len(dealt) == 5
    assert before - after == 5


def test_seeded_shuffle_is_deterministic_for_first_deal() -> None:
    deck_a = Deck()
    deck_b = Deck()

    deck_a.shuffle(seed=42)
    deck_b.shuffle(seed=42)

    cards_a = [str(card) for card in deck_a.deal(5)]
    cards_b = [str(card) for card in deck_b.deal(5)]
    assert cards_a == cards_b


def test_new_game_initialization_and_json_serialization() -> None:
    state = new_game(starting_stack=1000, small_blind=5, big_blind=10, seed=123)
    assert len(state.hands["hero"]) == 2
    assert len(state.hands["villain"]) == 2
    assert state.board == []
    assert state.street == "preflop"
    json.dumps(state.to_dict())


def test_advance_street_board_length_sequence() -> None:
    state = new_game(seed=7)
    assert len(state.board) == 0
    assert state.street == "preflop"

    advance_street(state)
    assert len(state.board) == 3
    assert state.street == "flop"

    advance_street(state)
    assert len(state.board) == 4
    assert state.street == "turn"

    advance_street(state)
    assert len(state.board) == 5
    assert state.street == "river"

    advance_street(state)
    assert len(state.board) == 5
    assert state.street == "showdown"
