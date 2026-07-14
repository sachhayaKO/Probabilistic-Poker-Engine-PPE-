import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('should exist and render without crashing', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});
