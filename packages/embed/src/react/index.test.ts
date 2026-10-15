import { describe, expect, it } from 'vitest';
import * as react from './index.js';

describe('@crewly/embed/react exports', () => {
  it('exposes CrewlyEmbed', () => {
    expect(typeof react.CrewlyEmbed).toBe('function');
  });
});
