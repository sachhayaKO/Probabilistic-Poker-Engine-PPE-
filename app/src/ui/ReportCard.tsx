import type { ProfileStats } from '../profile/aggregate';
import './ReportCard.css';

export interface ReportCardProps {
  stats: ProfileStats;
  onBack: () => void;
  onOpenHand: (handId: number) => void;
}

function formatSigned(n: number): string {
  const rounded = n.toFixed(1);
  return n >= 0 ? `+${rounded}` : rounded;
}

function TrendChart({ trend }: { trend: ProfileStats['trend'] }) {
  if (trend.length < 2) return null;

  const width = 100;
  const height = 40;
  const maxBucket = trend[trend.length - 1].bucket;
  const points = trend
    .map((p) => {
      const x = maxBucket === 0 ? 0 : (p.bucket / maxBucket) * width;
      const y = height - p.accuracy * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className="report-trend-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="accuracy trend"
    >
      <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth="1.5" />
    </svg>
  );
}

export function ReportCard({ stats, onBack, onOpenHand }: ReportCardProps) {
  return (
    <div className="report-card">
      <header className="report-header">
        <h1 className="report-title">Report Card</h1>
        <button type="button" className="btn btn-gold" onClick={onBack}>
          Back
        </button>
      </header>

      {stats.handsGraded === 0 ? (
        <p className="report-empty">Play some hands — your report card will appear here.</p>
      ) : (
        <>
          <div className="report-tiles">
            <div className="report-tile">
              <span className="report-tile-value">{stats.handsGraded}</span>
              <span className="report-tile-label">hands graded</span>
            </div>
            <div className="report-tile">
              <span className="report-tile-value">{stats.decisions}</span>
              <span className="report-tile-label">decisions</span>
            </div>
            <div className="report-tile">
              <span className="report-tile-value">{Math.round(stats.accuracy * 100)}%</span>
              <span className="report-tile-label">accuracy</span>
            </div>
            <div className="report-tile">
              <span className="report-tile-value">{formatSigned(stats.bb100)}</span>
              <span className="report-tile-label">bb/100</span>
            </div>
            <div className="report-tile">
              <span className="report-tile-value">
                {Math.round(stats.evLostTotal)} <span className="report-tile-unit">chips</span>
              </span>
              <span className="report-tile-label">ev lost (est.)</span>
            </div>
          </div>

          <section className="report-section">
            <h2 className="report-section-title">Accuracy Trend</h2>
            <TrendChart trend={stats.trend} />
          </section>

          <section className="report-section">
            <h2 className="report-section-title">Leaks</h2>
            {stats.leaks.length === 0 ? (
              <p className="report-empty-leaks">No recurring leaks yet.</p>
            ) : (
              <table className="report-leak-table">
                <thead>
                  <tr>
                    <th>Leak</th>
                    <th>Decisions</th>
                    <th>Mistakes</th>
                    <th>EV lost</th>
                    <th>Accuracy</th>
                    <th>Hands</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.leaks.map((leak) => (
                    <tr key={leak.key}>
                      <td>{leak.label}</td>
                      <td>{leak.decisions}</td>
                      <td>{leak.mistakes}</td>
                      <td>{Math.round(leak.evLost)}</td>
                      <td>{Math.round(leak.accuracy * 100)}%</td>
                      <td className="report-leak-hands">
                        {leak.handIds.slice(0, 3).map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="report-hand-btn"
                            onClick={() => onOpenHand(id)}
                          >
                            Hand #{id}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
