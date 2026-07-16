export function ChipStack({ amount, label }: { amount: number; label?: string }) {
  if (amount <= 0) return null;
  const chips = Math.max(1, Math.min(8, Math.round(Math.log2(amount / 50 + 1))));
  return (
    <div className="chipstack" aria-label={`${amount.toLocaleString()} chips${label ? ` ${label}` : ''}`}>
      <div className="chips">
        {Array.from({ length: chips }, (_, i) => (
          <div key={i} className="chip" style={{ bottom: i * 4 }} />
        ))}
      </div>
      <span className="chip-amount">
        {label ? `${label} ` : ''}
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
