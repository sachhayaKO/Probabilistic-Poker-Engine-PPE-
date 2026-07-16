import type { ReactNode } from 'react';
import type { GradedDecision } from '../grading/gradeHand';
import type { Phase } from './useGame';
import type { SessionStats } from './stats';
import { accuracy } from './stats';
import './Ribbon.css';

export interface RibbonProps {
  grades: GradedDecision[] | null;
  gradesFailed: boolean;
  stats: SessionStats;
  phase: Phase;
  matchOver: boolean;
  onOpenTheater: () => void;
}

const SYMBOL: Record<'best' | 'okay' | 'mistake', string> = {
  best: '✓',
  okay: '~',
  mistake: '✗',
};

const SYMBOL_CLASS: Record<'best' | 'okay' | 'mistake', string> = {
  best: 'ribbon-symbol-good',
  okay: 'ribbon-symbol-okay',
  mistake: 'ribbon-symbol-mistake',
};

function lineText(g: GradedDecision): { text: string; evLost: number } {
  if ('recommended' in g.grade) {
    const { label, actionTaken, recommended } = g.grade;
    return {
      text:
        label === 'best'
          ? `${actionTaken} — standard`
          : `you: ${actionTaken} · chart: ${recommended}`,
      evLost: 0,
    };
  }
  const { actionTaken, bestAction, evLost } = g.grade;
  return { text: `you: ${actionTaken} · best: ${bestAction}`, evLost };
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function Ribbon({ grades, gradesFailed, stats, phase, matchOver, onOpenTheater }: RibbonProps) {
  const acc = Math.round(accuracy(stats) * 100);
  const showReview = phase === 'over' || phase === 'runout';

  let body: ReactNode;
  if (!showReview && grades === null) {
    body = <p className="ribbon-hint">Play the hand — review appears here when it ends.</p>;
  } else if (gradesFailed) {
    body = <p className="ribbon-warning">Grading unavailable for this hand — next hand will retry.</p>;
  } else if (grades === null) {
    body = <p className="ribbon-pending">Grading…</p>;
  } else {
    body = (
      <ul className="ribbon-list">
        {grades.map((g) => {
          const { text, evLost } = lineText(g);
          const label = g.grade.label;
          return (
            <li
              key={g.logIndex}
              className={label === 'mistake' ? 'ribbon-line ribbon-line-mistake' : 'ribbon-line'}
            >
              <span className={SYMBOL_CLASS[label]}>{SYMBOL[label]}</span>
              <span className="ribbon-street">{capitalize(g.street)}</span>
              <span className="ribbon-text">
                {text}
                {evLost > 0 && <span className="ribbon-evlost"> (−{Math.round(evLost)})</span>}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <aside className="ribbon">
      <h2 className="ribbon-header">Review</h2>
      <div className="ribbon-stats">
        <span className="ribbon-stat">
          <span className="ribbon-stat-value">{stats.decisions}</span> hands
        </span>
        <span className="ribbon-stat">
          <span className="ribbon-stat-value">{acc}%</span> accuracy
        </span>
        <span className="ribbon-stat">
          <span className="ribbon-stat-value">{Math.round(stats.evLostTotal)}</span> ev lost
        </span>
      </div>
      <div className="ribbon-body">{body}</div>
      {grades !== null && !gradesFailed && (
        <div className="ribbon-footer">
          <button type="button" className="btn btn-gold" onClick={onOpenTheater}>
            Replay Theater <kbd>T</kbd>
          </button>
          <p className="ribbon-hint-next">
            {matchOver ? 'Match over' : (
              <>
                Next hand <kbd>N</kbd>
              </>
            )}
          </p>
        </div>
      )}
    </aside>
  );
}
