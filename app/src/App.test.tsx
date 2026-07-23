// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

async function enterCasino() {
  fireEvent.click(await screen.findByRole('button', { name: /enter the casino/i }));
}

describe('App', () => {
  it('boots to the splash screen and enters the Coach Feed', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /enter the casino/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /deal in/i })).toBeNull();
    await enterCasino();
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
  });

  it('shows the Coach Feed home screen after entering', async () => {
    render(<App />);
    await enterCasino();
    expect(screen.getByText(/Midnight Casino/i)).toBeTruthy();
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /deal in/i })).toBeTruthy();
    // jsdom has no indexedDB: openProfileStore falls back to the memory
    // store, which surfaces the "not saved" warning.
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('deals in from Coach Feed into a live hand', async () => {
    render(<App />);
    await enterCasino();
    await screen.findByRole('button', { name: /deal in/i });
    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    expect(screen.getByText(/Review/)).toBeTruthy(); // ribbon mounted
    expect(screen.getAllByLabelText('face-down card').length).toBeGreaterThan(0); // villain cards
  });

  it('leaving the table returns to Coach Feed without reloading the page', async () => {
    render(<App />);
    await enterCasino();
    await screen.findByRole('button', { name: /deal in/i });
    fireEvent.click(screen.getByRole('button', { name: /deal in/i }));
    fireEvent.click(screen.getByRole('button', { name: /leave table/i }));
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
  });

  it('opens the Report Card from home and returns to Coach Feed', async () => {
    render(<App />);
    await enterCasino();
    await screen.findByRole('button', { name: /deal in/i });
    fireEvent.click(screen.getByRole('button', { name: /report card/i }));
    expect(screen.getByRole('heading', { name: /Report Card/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByText(/Welcome to the tables/i)).toBeTruthy();
  });
});
