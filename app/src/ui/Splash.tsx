import { SuitPip } from './SuitPip';
import './Splash.css';

export interface SplashProps {
  onEnter: () => void;
}

/** Full-viewport gate shown before the coach dashboard. Click anywhere to enter. */
export function Splash({ onEnter }: SplashProps) {
  return (
    <div className="splash" onClick={onEnter}>
      <div className="splash-stage">
        <div className="splash-card card card-back dealt" aria-hidden="true" />
        <h1 className="splash-title">
          Probabilistic Poker Engine
          <span className="splash-flourish">Midnight Casino</span>
        </h1>
        <p className="splash-tagline">A poker trainer that learns your leaks.</p>
        <button type="button" className="btn btn-gold splash-enter" onClick={onEnter}>
          <SuitPip suit="spade" className="splash-enter-pip" />
          Enter the Casino
        </button>
      </div>
    </div>
  );
}
