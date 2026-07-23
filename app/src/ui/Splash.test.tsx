// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Splash } from './Splash';

describe('Splash', () => {
  it('renders title, flourish, and tagline', () => {
    render(<Splash onEnter={() => {}} />);
    expect(screen.getByRole('heading', { name: /probabilistic poker engine/i })).toBeTruthy();
    expect(screen.getByText(/midnight casino/i)).toBeTruthy();
    expect(screen.getByText('A poker trainer that learns your leaks.')).toBeTruthy();
  });

  it('calls onEnter from the button', () => {
    const onEnter = vi.fn();
    render(<Splash onEnter={onEnter} />);
    fireEvent.click(screen.getByRole('button', { name: /enter the casino/i }));
    expect(onEnter).toHaveBeenCalled();
  });

  it('calls onEnter when clicking anywhere on the screen', () => {
    const onEnter = vi.fn();
    const { container } = render(<Splash onEnter={onEnter} />);
    fireEvent.click(container.firstElementChild!);
    expect(onEnter).toHaveBeenCalled();
  });
});
