import { useEffect, useState } from "react"

interface CardProps {
  card?: string | null
  faceDown?: boolean
  index?: number  // stagger delay: index × 100ms
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: "♥",
  d: "♦",
  s: "♠",
  c: "♣",
}
const RED_SUITS = new Set(["h", "d"])

export function Card({ card, faceDown = false, index = 0 }: CardProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), index * 100 + 50)
    return () => clearTimeout(t)
  }, [index])

  const base = `w-14 h-20 rounded-lg transition-all duration-300 ${
    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
  }`

  if (faceDown || !card) {
    return (
      <div className={`${base} border border-slate-700 bg-[#0f172a] flex items-center justify-center`}>
        <div className="w-10 h-16 rounded border border-slate-700/60 bg-slate-900/80 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-0.5 opacity-30">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-slate-500" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const rank = card.slice(0, -1)
  const suit = card.slice(-1)
  const isRed = RED_SUITS.has(suit)
  const color = isRed ? "#dc2626" : "#1e293b"
  const symbol = SUIT_SYMBOLS[suit] ?? "?"

  return (
    <div
      className={`${base} border border-slate-300 bg-white flex flex-col justify-between p-1.5 select-none`}
    >
      <div className="text-xs font-bold font-mono leading-tight" style={{ color }}>
        {rank}
        <br />
        {symbol}
      </div>
      <div className="text-center text-base leading-none" style={{ color }}>
        {symbol}
      </div>
      <div
        className="text-xs font-bold font-mono leading-tight text-right rotate-180"
        style={{ color }}
      >
        {rank}
        <br />
        {symbol}
      </div>
    </div>
  )
}
