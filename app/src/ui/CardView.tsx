import type { Card } from '../engine/cards';
import { RANKS, SUITS, rankOf, suitOf } from '../engine/cards';

const SUIT_GLYPHS = ['♣', '♦', '♥', '♠']; // index-aligned with SUITS 'cdhs'
const SUIT_RED = [false, true, true, false];

export function CardView({
  card,
  faceDown = false,
  dealt = false,
}: {
  card?: Card;
  faceDown?: boolean;
  dealt?: boolean;
}) {
  if (faceDown || card === undefined) {
    return <div className={`card card-back${dealt ? ' dealt' : ''}`} aria-label="face-down card" />;
  }
  const r = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className={`card card-face${SUIT_RED[s] ? ' red' : ''}${dealt ? ' dealt' : ''}`}
      aria-label={`${r}${SUITS[s]}`}
    >
      <span className="card-rank">{r === 'T' ? '10' : r}</span>
      <span className="card-suit">{SUIT_GLYPHS[s]}</span>
    </div>
  );
}
