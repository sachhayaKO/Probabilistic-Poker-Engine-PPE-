from __future__ import annotations

from engine.poker import Card, Deck, new_game


def test_card_roundtrip() -> None:
    card = Card.from_str("Ah")
    assert str(card) == "Ah"


def test_seeded_decks_match() -> None:
    deck_a = Deck(seed=42)
    deck_b = Deck(seed=42)

    deck_a.shuffle()
    deck_b.shuffle()

    cards_a = [str(card) for card in deck_a.deal(5)]
    cards_b = [str(card) for card in deck_b.deal(5)]
    assert cards_a == cards_b


def test_new_game_public_state_serializable_shape() -> None:
    state = new_game(stack_size=1000, small_blind=5, big_blind=10, seed=123)
    public_state = state.to_public_dict()

    assert public_state["game_id"]
    assert public_state["board"] == []
    assert public_state["to_act"] in {"hero", "villain"}
    assert public_state["hands"]["villain"] == []
