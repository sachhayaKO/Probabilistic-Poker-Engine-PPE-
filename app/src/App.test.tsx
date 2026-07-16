// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows the menu, then deals into a hand', () => {
    render(<App />);
    expect(screen.getByText(/Midnight Casino/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Training/i));
    fireEvent.click(screen.getByText(/The Balanced Player/i));
    fireEvent.click(screen.getByRole('button', { name: /deal me in/i }));
    expect(screen.getByText(/Review/)).toBeTruthy(); // ribbon mounted
    expect(screen.getAllByLabelText('face-down card').length).toBeGreaterThan(0); // villain cards
  });
});
