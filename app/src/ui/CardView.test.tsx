// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardView } from './CardView'

describe('CardView', () => {
  it('renders two cards with correct rank and suit', () => {
    render(<CardView rank="A" suit="♠" />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
  })

  it('applies correct styling to rank span', () => {
    render(<CardView rank="K" suit="♥" />)
    const rankSpan = screen.getByText('K')
    expect(rankSpan.className).toContain('rank')
  })

  it('applies correct styling to suit span', () => {
    render(<CardView rank="Q" suit="♦" />)
    const suitSpan = screen.getByText('♦')
    expect(suitSpan.className).toContain('suit')
  })

  it('applies red color for hearts', () => {
    const { container } = render(<CardView rank="5" suit="♥" />)
    const suitSpan = container.querySelector('.suit')
    expect(suitSpan?.className).toContain('red')
  })

  it('applies red color for diamonds', () => {
    const { container } = render(<CardView rank="3" suit="♦" />)
    const suitSpan = container.querySelector('.suit')
    expect(suitSpan?.className).toContain('red')
  })

  it('applies black color for spades', () => {
    const { container } = render(<CardView rank="2" suit="♠" />)
    const suitSpan = container.querySelector('.suit')
    expect(suitSpan?.className).toContain('black')
  })

  it('applies black color for clubs', () => {
    const { container } = render(<CardView rank="7" suit="♣" />)
    const suitSpan = container.querySelector('.suit')
    expect(suitSpan?.className).toContain('black')
  })
})
