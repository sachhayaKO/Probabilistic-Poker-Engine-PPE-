import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { SuitPip, type Suit } from './SuitPip';

interface DriftPip {
  suit: Suit;
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
}

/* Scattered around the viewport edges so the center stays clear for content. */
const PIPS: DriftPip[] = [
  { suit: 'spade', top: '12%', left: '7%', size: 34, delay: 0, duration: 16 },
  { suit: 'heart', top: '22%', left: '88%', size: 26, delay: 2.5, duration: 13 },
  { suit: 'club', top: '64%', left: '5%', size: 28, delay: 1.2, duration: 15 },
  { suit: 'diamond', top: '78%', left: '92%', size: 30, delay: 4, duration: 17 },
  { suit: 'club', top: '8%', left: '68%', size: 20, delay: 3.1, duration: 12 },
  { suit: 'diamond', top: '42%', left: '13%', size: 18, delay: 5.4, duration: 14 },
  { suit: 'spade', top: '86%', left: '24%', size: 24, delay: 2, duration: 18 },
  { suit: 'heart', top: '58%', left: '82%', size: 22, delay: 6, duration: 15 },
];

/* Face-down community cards resting on the felt, fanned like a dealt flop. */
const CARDS = [
  { top: '58%', left: '30%', rot: -8 },
  { top: '61%', left: '46%', rot: -1 },
  { top: '59%', left: '62%', rot: 7 },
];

/**
 * Decorative fixed backdrop shared by the splash and coach dashboard:
 * the ghost felt oval plus drifting suit pips, faint dealt cards, and a
 * candle-glow spotlight that trails the mouse. Purely visual — no pointer
 * events, and the mouse tracking is skipped under prefers-reduced-motion.
 */
export function GhostTable() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let raf = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.4;
    let x = targetX;
    let y = targetY;

    const tick = () => {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      el.style.setProperty('--nx', `${x / window.innerWidth - 0.5}`);
      el.style.setProperty('--ny', `${y / window.innerHeight - 0.5}`);
      raf =
        Math.abs(targetX - x) + Math.abs(targetY - y) > 0.5
          ? requestAnimationFrame(tick)
          : 0;
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="ghost-table" aria-hidden="true">
      <div className="ghost-drift">
        {CARDS.map((c, i) => (
          <div
            key={`card-${i}`}
            className="ghost-card-outline"
            style={{ top: c.top, left: c.left, transform: `rotate(${c.rot}deg)` }}
          />
        ))}
        {PIPS.map((p, i) => (
          <span
            key={`pip-${i}`}
            className={`ghost-pip${p.suit === 'heart' || p.suit === 'diamond' ? ' ghost-pip-red' : ''}`}
            style={
              {
                top: p.top,
                left: p.left,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              } as CSSProperties
            }
          >
            <SuitPip suit={p.suit} />
          </span>
        ))}
      </div>
      <div className="ghost-glow" />
    </div>
  );
}
