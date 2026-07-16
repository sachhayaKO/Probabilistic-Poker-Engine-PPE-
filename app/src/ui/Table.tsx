import { useEffect, useRef } from 'react';
import type { Seat } from '../engine/hand';
import { PERSONAS } from '../personas/persona';
import { CardView } from './CardView';
import { ChipStack } from './ChipStack';
import { BIG_BLIND, HERO_SEAT, VILLAIN_SEAT } from './gameMachine';
import * as sound from './sound';
import type { Game } from './useGame';
import './Table.css';

function seatLabel(game: Game, seat: Seat): string {
  if (seat === HERO_SEAT) return 'You';
  const key = game.session?.personaKey;
  return key ? PERSONAS[key].name : 'Villain';
}

function resultBanner(game: Game): string | null {
  const { hand, session } = game;
  if (!hand || !hand.result) return null;
  const { winner, potAwarded } = hand.result;
  if (winner === null) return 'Split pot';
  if (winner === HERO_SEAT) return `You win ${potAwarded.toLocaleString()}`;
  const key = session?.personaKey;
  const name = key ? PERSONAS[key].name : 'Villain';
  return `${name} wins ${potAwarded.toLocaleString()}`;
}

function SeatView({
  game,
  seat,
  position,
}: {
  game: Game;
  seat: Seat;
  position: 'top' | 'bottom';
}) {
  const { hand, phase } = game;
  if (!hand) return null;
  const showCards = seat === HERO_SEAT || (hand.result !== null && hand.result.showdown);
  const stack = hand.result ? hand.result.stacks[seat] : hand.stacks[seat];
  const committed = hand.committed[seat];
  const isActing = !hand.result && ((phase === 'hero' && seat === HERO_SEAT) || (phase === 'villain' && seat === VILLAIN_SEAT));
  const isButton = hand.cfg.buttonSeat === seat;
  const name = seatLabel(game, seat);

  return (
    <div className={`seat seat-${position}${isActing ? ' acting' : ''}`}>
      {isButton && (
        <div className="dealer-button" aria-label="dealer button">
          D
        </div>
      )}
      <div className="seat-name">{name}</div>
      <div className="seat-cards">
        <CardView card={hand.holes[seat][0]} faceDown={!showCards} dealt={seat === HERO_SEAT} />
        <CardView card={hand.holes[seat][1]} faceDown={!showCards} dealt={seat === HERO_SEAT} />
      </div>
      <div className="seat-stack">
        {stack.toLocaleString()} <span className="seat-bb">({(stack / BIG_BLIND).toFixed(1)} BB)</span>
      </div>
      {committed > 0 && (
        <div className="seat-committed">
          <ChipStack amount={committed} />
        </div>
      )}
    </div>
  );
}

function BoardRow({ visibleBoard }: { visibleBoard: Game['visibleBoard'] }) {
  const slots = Array.from({ length: 5 }, (_, i) => visibleBoard[i]);
  return (
    <div className="board-row">
      {slots.map((card, i) =>
        card !== undefined ? (
          <CardView key={i} card={card} dealt />
        ) : (
          <div key={i} className="card card-slot" aria-hidden="true" />
        ),
      )}
    </div>
  );
}

function EquityRace({ race }: { race: { hero: number; villain: number } | null }) {
  if (race === null) return null;
  const heroPct = Math.round(race.hero * 100);
  const villainPct = Math.round(race.villain * 100);
  return (
    <div className="equity-race" role="status" aria-label="live equity race">
      <div className="equity-row">
        <span className="equity-label">You</span>
        <div className="equity-bar-track">
          <div className="equity-bar hero" style={{ width: `${heroPct}%` }} />
        </div>
        <span className="equity-pct">{heroPct}%</span>
      </div>
      <div className="equity-row">
        <span className="equity-label">Villain</span>
        <div className="equity-bar-track">
          <div className="equity-bar villain" style={{ width: `${villainPct}%` }} />
        </div>
        <span className="equity-pct">{villainPct}%</span>
      </div>
    </div>
  );
}

export function Table({ game }: { game: Game }) {
  const { hand, visibleBoard, phase, race } = game;

  const prevBoardLen = useRef(0);
  useEffect(() => {
    if (visibleBoard.length > prevBoardLen.current) {
      sound.cardFlip();
    }
    prevBoardLen.current = visibleBoard.length;
  }, [visibleBoard]);

  const prevHoles = useRef<unknown>(null);
  useEffect(() => {
    if (hand && prevHoles.current !== hand.holes) {
      prevHoles.current = hand.holes;
      sound.cardSlide();
    }
    if (!hand) prevHoles.current = null;
  }, [hand]);

  if (!hand) return null;

  const pot = hand.pot + hand.committed[0] + hand.committed[1];
  const banner = phase === 'over' ? resultBanner(game) : null;

  return (
    <div className="table-felt">
      <SeatView game={game} seat={VILLAIN_SEAT} position="top" />

      <div className="board-area">
        <BoardRow visibleBoard={visibleBoard} />
        <div className="pot-display">
          <ChipStack amount={pot} label="pot" />
        </div>
      </div>

      <SeatView game={game} seat={HERO_SEAT} position="bottom" />

      {banner && <div className="result-banner">{banner}</div>}
      {phase === 'runout' && <EquityRace race={race} />}
    </div>
  );
}
