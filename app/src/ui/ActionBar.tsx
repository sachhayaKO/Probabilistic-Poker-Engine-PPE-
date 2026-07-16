import { useEffect, useState } from 'react';
import { BET_PRESETS, presetRaiseTo } from './gameMachine';
import type { Game } from './useGame';
import * as sound from './sound';

const DEFAULT_PRESET = 1; // 50%

export function ActionBar({ game }: { game: Game }) {
  const { hand, legal, phase, act, nextHand } = game;
  const [raiseTo, setRaiseTo] = useState(0);

  // Reset the raise input to the default preset each time it's hero's turn.
  useEffect(() => {
    if (hand && legal?.canRaise) {
      setRaiseTo(presetRaiseTo(hand, BET_PRESETS[DEFAULT_PRESET].fraction));
    }
  }, [hand, legal]);

  const fold = () => {
    if (legal?.canFold) {
      sound.cardSlide();
      act({ type: 'fold' });
    }
  };
  const call = () => {
    if (legal) {
      if (legal.callAmount > 0) sound.chipClink();
      act({ type: 'call' });
    }
  };
  const raise = (to: number) => {
    if (legal?.canRaise && to > 0) {
      sound.chipClink();
      act({ type: 'raise', to });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (phase === 'over') {
        if (k === 'n' || k === ' ') {
          e.preventDefault();
          nextHand();
        }
        return;
      }
      if (phase !== 'hero' || !hand || !legal) return;
      if (k === 'f') fold();
      else if (k === 'c') call();
      else if (k === 'r') raise(raiseTo);
      else if (k >= '1' && k <= '4' && legal.canRaise) {
        raise(presetRaiseTo(hand, BET_PRESETS[Number(k) - 1].fraction));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (phase === 'over') {
    return (
      <div className="actionbar">
        <button type="button" className="btn btn-gold" onClick={nextHand}>
          Next hand <kbd>N</kbd>
        </button>
      </div>
    );
  }

  if (phase !== 'hero' || !hand || !legal) {
    return <div className="actionbar actionbar-idle" />;
  }

  return (
    <div className="actionbar">
      <button type="button" className="btn btn-fold" disabled={!legal.canFold} onClick={fold}>
        Fold <kbd>F</kbd>
      </button>
      <button type="button" className="btn btn-call" onClick={call}>
        {legal.callAmount > 0 ? `Call ${legal.callAmount.toLocaleString()}` : 'Check'} <kbd>C</kbd>
      </button>
      {legal.canRaise && (
        <div className="raise-group">
          {BET_PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              className="btn btn-preset"
              onClick={() => raise(presetRaiseTo(hand, p.fraction))}
            >
              {p.label} <kbd>{i + 1}</kbd>
            </button>
          ))}
          <input
            type="number"
            className="raise-input"
            aria-label="raise to"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
          />
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => raise(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, raiseTo)))}
          >
            Raise <kbd>R</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
