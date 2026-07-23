export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

const PATHS: Record<Suit, string> = {
  spade:
    'M12 2C9 7 4 10 4 14a4 4 0 0 0 7 2.6c-.2 1.8-.8 3.2-2 4.4h6c-1.2-1.2-1.8-2.6-2-4.4A4 4 0 0 0 20 14c0-4-5-7-8-12z',
  heart:
    'M12 21c-5.5-4.5-9-7.8-9-11.5A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 21 9.5C21 13.2 17.5 16.5 12 21z',
  diamond: 'M12 2l6.5 10L12 22 5.5 12 12 2z',
  club:
    'M12 2a4 4 0 0 0-3.2 6.4 4 4 0 1 0 2.2 7c-.2 2-.8 3.4-2 4.6h6c-1.2-1.2-1.8-2.6-2-4.6a4 4 0 1 0 2.2-7A4 4 0 0 0 12 2z',
};

export function SuitPip({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[suit]} fill="currentColor" />
    </svg>
  );
}
