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

type Verdict = 'best' | 'okay' | 'mistake';

const SYMBOL: Record<Verdict, string> = {
  best: '✓',
  okay: '~',
  mistake: '✗',
};

const VERDICT_WORD: Record<Verdict, string> = {
  best: 'best',
  okay: 'okay',
  mistake: 'mistake',
};

function lineActions(g: GradedDecision): { taken: string; wanted: string | null; evLost: number } {
  if ('recommended' in g.grade) {
    const { label, actionTaken, recommended } = g.grade;
    return {
      taken: actionTaken,
      wanted: label === 'best' ? null : recommended,
      evLost: 0,
    };
  }
  const { actionTaken, bestAction, evLost } = g.grade;
  return { taken: actionTaken, wanted: actionTaken === bestAction ? null : bestAction, evLost };
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

/** Circular session-accuracy gauge. */
function AccuracyRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  return (
    <svg className="ribbon-ring" viewBox="0 0 64 64" role="img" aria-label={`${pct}% accuracy`}>
      <circle className="ribbon-ring-track" cx="32" cy="32" r={r} />
      <circle
        className="ribbon-ring-fill"
        cx="32"
        cy="32"
        r={r}
        strokeDasharray={`${filled} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text className="ribbon-ring-value" x="32" y="31" textAnchor="middle">
        {pct}%
      </text>
      <text className="ribbon-ring-label" x="32" y="42" textAnchor="middle">
        acc
      </text>
    </svg>
  );
}

export function Ribbon({ grades, gradesFailed, stats, phase, matchOver, onOpenTheater }: RibbonProps) {
  const acc = Math.round(accuracy(stats) * 100);
  const showReview = phase === 'over' || phase === 'runout';

  let body: ReactNode;
  if (!showReview && grades === null) {
    body = (
      <div className="ribbon-empty">
        <div className="ribbon-empty-cards" aria-hidden="true">
          <span className="ribbon-empty-card" />
          <span className="ribbon-empty-card" />
        </div>
        <p className="ribbon-hint">Play the hand — review appears here when it ends.</p>
      </div>
    );
  } else if (gradesFailed) {
    body = <p className="ribbon-warning">Grading unavailable for this hand — next hand will retry.</p>;
  } else if (grades === null) {
    body = <p className="ribbon-pending">Grading…</p>;
  } else {
    const counts: Record<Verdict, number> = { best: 0, okay: 0, mistake: 0 };
    for (const g of grades) counts[g.grade.label] += 1;
    const maxEv = Math.max(1, ...grades.map((g) => lineActions(g).evLost));
    const handEvLost = grades.reduce((sum, g) => sum + lineActions(g).evLost, 0);

    body = (
      <>
        <div className="ribbon-verdict-chips">
          {(['best', 'okay', 'mistake'] as Verdict[]).map(
            (v) =>
              counts[v] > 0 && (
                <span key={v} className={`ribbon-chip ribbon-chip-${v}`}>
                  <span className="ribbon-chip-symbol">{SYMBOL[v]}</span>
                  {counts[v]} {VERDICT_WORD[v]}
                  {counts[v] > 1 && v !== 'best' ? 's' : ''}
                </span>
              ),
          )}
        </div>
        <ul className="ribbon-list">
          {grades.map((g) => {
            const { taken, wanted, evLost } = lineActions(g);
            const label = g.grade.label;
            return (
              <li key={g.logIndex} className={`ribbon-line ribbon-line-${label}`}>
                <span className={`ribbon-verdict ribbon-verdict-${label}`} aria-hidden="true">
                  {SYMBOL[label]}
                </span>
                <div className="ribbon-line-main">
                  <div className="ribbon-line-top">
                    <span className="ribbon-street">{capitalize(g.street)}</span>
                    <span className="ribbon-text">
                      {wanted === null ? (
                        <>
                          <span className="ribbon-action">{taken}</span> — standard
                        </>
                      ) : (
                        <>
                          you: <span className="ribbon-action">{taken}</span> · best:{' '}
                          <span className="ribbon-action ribbon-action-best">{wanted}</span>
                        </>
                      )}
                    </span>
                  </div>
                  {evLost > 0 && (
                    <div className="ribbon-evbar-row">
                      <span className="ribbon-evbar">
                        <span
                          className="ribbon-evbar-fill"
                          style={{ width: `${Math.max(8, Math.round((evLost / maxEv) * 100))}%` }}
                        />
                      </span>
                      <span className="ribbon-evlost">−{Math.round(evLost)}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {handEvLost > 0 && (
          <p className="ribbon-hand-ev">
            This hand cost you <span className="ribbon-evlost">{Math.round(handEvLost)} chips</span> (est.)
          </p>
        )}
      </>
    );
  }

  return (
    <aside className="ribbon">
      <h2 className="ribbon-header">Review</h2>
      <div className="ribbon-gauge-row">
        <AccuracyRing pct={acc} />
        <div className="ribbon-stats">
          <span className="ribbon-stat">
            <span className="ribbon-stat-value">{stats.decisions}</span> decisions
          </span>
          <span className="ribbon-stat">
            <span className="ribbon-stat-value">{Math.round(stats.evLostTotal)}</span> ev lost
          </span>
        </div>
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
