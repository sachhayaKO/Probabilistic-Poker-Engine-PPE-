/** Themed speaker glyph for the sound toggle. Color via currentColor. */
export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 9.2v5.6a.8.8 0 0 0 .8.8H8l4.4 3.6a.6.6 0 0 0 1-.5V5.3a.6.6 0 0 0-1-.5L8 8.4H4.8a.8.8 0 0 0-.8.8z"
        fill="currentColor"
      />
      {on ? (
        <>
          <path
            d="M16 9.4a3.6 3.6 0 0 1 0 5.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M18.4 7.2a6.8 6.8 0 0 1 0 9.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M16.2 9.7l4.6 4.6m0-4.6l-4.6 4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
