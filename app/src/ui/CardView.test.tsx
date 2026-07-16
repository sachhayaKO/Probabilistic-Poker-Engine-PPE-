// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cardFromString } from '../engine/cards';
import { CardView } from './CardView';

describe('CardView', () => {
  it('renders rank and suit for a face-up card', () => {
    render(<CardView card={cardFromString('Ah')} />);
    const el = screen.getByLabelText('Ah');
    expect(el.textContent).toContain('A');
    expect(el.textContent).toContain('♥');
    expect(el.className).toContain('red');
  });

  it('renders T as 10 and black suits without the red class', () => {
    render(<CardView card={cardFromString('Ts')} />);
    const el = screen.getByLabelText('Ts');
    expect(el.textContent).toContain('10');
    expect(el.className).not.toContain('red');
  });

  it('renders a face-down back', () => {
    render(<CardView faceDown card={cardFromString('Ah')} />);
    expect(screen.getByLabelText('face-down card').className).toContain('card-back');
  });
});
