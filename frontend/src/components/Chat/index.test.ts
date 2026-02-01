/**
 * Chat Components Index Tests
 *
 * Tests that all chat components are exported correctly.
 *
 * @module components/Chat/index.test
 */

import { describe, it, expect } from 'vitest';
import {
  ChatPanel,
  ChatMessage,
  ChatInput,
  ChatSidebar,
  TypingIndicator,
} from './index';

describe('Chat Components Index', () => {
  it('exports ChatPanel', () => {
    expect(ChatPanel).toBeDefined();
    expect(typeof ChatPanel).toBe('function');
  });

  it('exports ChatMessage', () => {
    expect(ChatMessage).toBeDefined();
    expect(typeof ChatMessage).toBe('function');
  });

  it('exports ChatInput', () => {
    expect(ChatInput).toBeDefined();
    expect(typeof ChatInput).toBe('function');
  });

  it('exports ChatSidebar', () => {
    expect(ChatSidebar).toBeDefined();
    expect(typeof ChatSidebar).toBe('function');
  });

  it('exports TypingIndicator', () => {
    expect(TypingIndicator).toBeDefined();
    expect(typeof TypingIndicator).toBe('function');
  });
});
