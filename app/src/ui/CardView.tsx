import type { ReactNode } from 'react'
import './theme.css'

interface CardViewProps {
  rank: string
  suit: string
}

export function CardView({ rank, suit }: CardViewProps): ReactNode {
  const suitColor = suit === '♥' || suit === '♦' ? 'red' : 'black'

  return (
    <div className="card">
      <span className="rank">{rank}</span>
      <span className={`suit ${suitColor}`}>{suit}</span>
    </div>
  )
}
