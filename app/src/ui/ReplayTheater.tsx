import { useEffect, useState } from 'react';
import type { HandState, Seat } from '../engine/hand';
import type { DecisionGrade, GradeLabel } from '../grading/grade';
import type { GradedDecision, PreflopGrade } from '../grading/gradeHand';
import { CardView } from './CardView';
import { HERO_SEAT } from './gameMachine';
import './ReplayTheater.css';

export interface ReplayTheaterProps {
  hand: HandState; // hand.result !== null
  grades: GradedDecision[];
  personaName: string;
  onClose: () => void;
}

type LogEntry = HandState['log'][number];

const SYMBOL: Record<GradeLabel, string> = { best: '✓', okay: '~', mistake: '✗' };
const SYMBOL_CLASS: Record<GradeLabel, string> = {
  best: 'replay-symbol-good',
  okay: 'replay-symbol-okay',
  mistake: 'replay-symbol-mistake',
};

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

function actorName(seat: Seat, personaName: string): string {
  return seat === HERO_SEAT ? 'You' : personaName;
}

function describeAction(action: LogEntry['action']): string {
  if (action.type === 'fold') return 'folds';
  if (action.type === 'call') return 'calls';
  return `raises to ${action.to.toLocaleString()}`;
}

function EVBarRow({
  label, ev, maxAbs, isBest, isTaken,
}: { label: string; ev: number; maxAbs: number; isBest: boolean; isTaken: boolean }) {
  const pct = maxAbs === 0 ? 4 : Math.max(4, (Math.abs(ev) / maxAbs) * 100);
  return (
    <div className={`replay-bar-row${isBest ? ' replay-bar-best' : ''}`}>
      <span className="replay-bar-label">
        {label}
        {isTaken && <span className="replay-tag-you">you</span>}
      </span>
      <div className="replay-bar-track">
        <div
          className={`replay-bar-fill ${ev >= 0 ? 'replay-bar-good' : 'replay-bar-red'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="replay-bar-value">{Math.round(ev).toLocaleString()}</span>
    </div>
  );
}

function GradePanel({ grade }: { grade: DecisionGrade | PreflopGrade }) {
  if ('recommended' in grade) {
    return (
      <div className="replay-grade replay-grade-preflop">
        <p className="replay-grade-label">
          <span className={SYMBOL_CLASS[grade.label]}>{SYMBOL[grade.label]}</span>
          {' '}
          {cap(grade.label)}
        </p>
        <blockquote className="replay-equation">{grade.explanation}</blockquote>
      </div>
    );
  }

  const { evByAction, bestAction, actionTaken, equity, requiredEquity, explanation } = grade;
  const values = [evByAction.fold, evByAction.call, evByAction.raise].filter(
    (v): v is number => v !== null,
  );
  const maxAbs = Math.max(0, ...values.map((v) => Math.abs(v)));

  return (
    <div className="replay-grade replay-grade-postflop">
      <div className="replay-bars">
        <EVBarRow
          label="Fold" ev={evByAction.fold} maxAbs={maxAbs}
          isBest={bestAction === 'fold'} isTaken={actionTaken === 'fold'}
        />
        <EVBarRow
          label="Call" ev={evByAction.call} maxAbs={maxAbs}
          isBest={bestAction === 'call'} isTaken={actionTaken === 'call'}
        />
        {evByAction.raise === null ? (
          <p className="replay-no-raise">raise wasn't available</p>
        ) : (
          <EVBarRow
            label="Raise" ev={evByAction.raise} maxAbs={maxAbs}
            isBest={bestAction === 'raise'} isTaken={actionTaken === 'raise'}
          />
        )}
      </div>
      <blockquote className="replay-equation">{explanation}</blockquote>
      <p className="replay-equity-line">
        equity {Math.round(equity * 100)}% vs required{' '}
        {requiredEquity !== null ? `${Math.round(requiredEquity * 100)}%` : 'n/a'}
      </p>
    </div>
  );
}

function StepView({
  entry, hand, personaName, grade,
}: {
  entry: LogEntry;
  hand: HandState;
  personaName: string;
  grade: GradedDecision | null;
}) {
  return (
    <div className="replay-step">
      <div className="replay-board">
        {entry.board.map((c, i) => <CardView key={i} card={c} />)}
      </div>
      <p className="replay-pot">
        Pot: <span className="replay-mono">{Math.round(entry.potBefore).toLocaleString()}</span>
      </p>
      <div className="replay-holes">
        {([0, 1] as const).map((seat) => (
          <div key={seat} className="replay-hole">
            <span className="replay-hole-name">{actorName(seat, personaName)}</span>
            <div className="replay-hole-cards">
              <CardView card={hand.holes[seat][0]} />
              <CardView card={hand.holes[seat][1]} />
            </div>
          </div>
        ))}
      </div>
      <p className="replay-action">
        <strong>{actorName(entry.seat, personaName)}</strong> {describeAction(entry.action)}
      </p>
      {entry.seat !== HERO_SEAT ? null : grade ? (
        <GradePanel grade={grade.grade} />
      ) : (
        <p className="replay-no-grade">No decision to grade here.</p>
      )}
    </div>
  );
}

function ResultSummary({ hand, personaName }: { hand: HandState; personaName: string }) {
  const result = hand.result!;
  const winnerText =
    result.winner === null ? 'Split pot' : `${actorName(result.winner, personaName)} wins`;
  return (
    <div className="replay-result">
      <p className="replay-result-winner">{winnerText}</p>
      <p className="replay-result-pot">
        Pot awarded:{' '}
        <span className="replay-mono">{Math.round(result.potAwarded).toLocaleString()}</span>
      </p>
      <p className="replay-result-mode">{result.showdown ? 'Showdown' : 'Won by fold'}</p>
    </div>
  );
}

export function ReplayTheater({ hand, grades, personaName, onClose }: ReplayTheaterProps) {
  const [idx, setIdx] = useState(0);
  const maxIdx = hand.log.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(maxIdx, i + 1));
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maxIdx, onClose]);

  const isResultStep = idx === maxIdx;
  const entry = isResultStep ? null : hand.log[idx];
  const grade =
    entry && entry.seat === HERO_SEAT ? (grades.find((g) => g.logIndex === idx) ?? null) : null;

  return (
    <div className="replay-scrim">
      <div className="replay-stage" role="dialog" aria-modal="true">
        <header className="replay-header">
          <h2 className="replay-title">Replay Theater — Hand review</h2>
          <button type="button" className="replay-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="replay-scrubber">
          <button
            type="button" className="replay-nav-btn"
            onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          >
            ‹ Prev
          </button>
          <span className="replay-step-counter">
            {isResultStep ? 'Result' : `Decision ${idx + 1} of ${maxIdx}`}
          </span>
          <button
            type="button" className="replay-nav-btn"
            onClick={() => setIdx((i) => Math.min(maxIdx, i + 1))} disabled={idx === maxIdx}
          >
            Next ›
          </button>
        </div>

        {isResultStep ? (
          <ResultSummary hand={hand} personaName={personaName} />
        ) : (
          <StepView entry={entry!} hand={hand} personaName={personaName} grade={grade} />
        )}
      </div>
    </div>
  );
}
