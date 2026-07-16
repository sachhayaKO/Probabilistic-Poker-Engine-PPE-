import type { ReactNode } from 'react'
import './theme.css'

interface ChipStackProps {
  count: number
}

export function ChipStack({ count }: ChipStackProps): ReactNode {
  return (
    <div className="chip-stack">
      <div className="chip">{count}</div>
    </div>
  )
}
