import { useState } from 'react';
import type { HandRecord } from '../profile/records';
import type { SessionSummary } from '../profile/sessions';
import { groupSessions } from '../profile/sessions';
import { personaMeta } from './personaMeta';
import { SuitPip } from './SuitPip';

export interface MatchHistoryProps {
  records: HandRecord[];
  onOpenHand: (handId: number) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatChips(n: number): string {
  const rounded = Math.round(n);
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}

function badge(s: SessionSummary): string {
  if (s.drill) return 'Drill';
  return s.mode === 'match' ? 'Match' : 'Training';
}

function SessionHands({
  session,
  records,
  onOpenHand,
}: {
  session: SessionSummary;
  records: HandRecord[];
  onOpenHand: (handId: number) => void;
}) {
  const byId = new Map(records.filter((r) => r.id !== undefined).map((r) => [r.id!, r]));
  return (
    <ul className="history-hands">
      {session.handIds.map((id) => {
        const hand = byId.get(id);
        if (!hand) return null;
        const mistakes = hand.decisions.filter((d) => d.label === 'mistake').length;
        return (
          <li key={id} className="history-hand">
            <span className={`history-hand-net${hand.heroNet < 0 ? ' history-neg' : ' history-pos'}`}>
              {formatChips(hand.heroNet)}
            </span>
            <span className="history-hand-mistakes">
              {mistakes === 0 ? 'clean' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`}
            </span>
            <button type="button" className="history-hand-btn" onClick={() => onOpenHand(id)}>
              Hand #{id}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MatchHistory({ records, onOpenHand }: MatchHistoryProps) {
  const sessions = groupSessions(records);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (sessions.length === 0) {
    return <p className="report-empty">Play your first session — your match history will appear here.</p>;
  }

  return (
    <ul className="history-list">
      {sessions.map((s, i) => {
        const m = personaMeta(s.personaKey);
        const red = m.crest === 'heart' || m.crest === 'diamond';
        const open = openIndex === i;
        return (
          <li key={`${s.start}-${i}`} className={`history-session${open ? ' history-session-open' : ''}`}>
            <button
              type="button"
              className="history-row"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : i)}
            >
              <span className="history-date">{formatDate(s.start)}</span>
              <span className="history-persona">
                <SuitPip suit={m.crest} className={`history-crest${red ? ' history-crest-red' : ''}`} />
                {m.name}
              </span>
              <span className={`history-badge history-badge-${badge(s).toLowerCase()}`}>{badge(s)}</span>
              <span className="history-hand-count">{s.handCount} hands</span>
              <span className={`history-net${s.netChips < 0 ? ' history-neg' : ' history-pos'}`}>
                {formatChips(s.netChips)}
              </span>
              <span className="history-accuracy">{Math.round(s.accuracy * 100)}%</span>
            </button>
            {open && <SessionHands session={s} records={records} onOpenHand={onOpenHand} />}
          </li>
        );
      })}
    </ul>
  );
}
