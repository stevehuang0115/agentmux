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
  QueueStatusBar,
  ChannelBadge,
  ChannelFilterBar,
  ThreadListPanel,
  ThreadPreview,
  ThreadDetailPanel,
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

  it('exports QueueStatusBar', () => {
    expect(QueueStatusBar).toBeDefined();
    expect(typeof QueueStatusBar).toBe('function');
  });

  it('exports ChannelBadge', () => {
    expect(ChannelBadge).toBeDefined();
    expect(typeof ChannelBadge).toBe('function');
  });

  it('exports ChannelFilterBar', () => {
    expect(ChannelFilterBar).toBeDefined();
    expect(typeof ChannelFilterBar).toBe('function');
  });

  it('exports ThreadListPanel', () => {
    expect(ThreadListPanel).toBeDefined();
    expect(typeof ThreadListPanel).toBe('function');
  });

  it('exports ThreadPreview', () => {
    expect(ThreadPreview).toBeDefined();
    expect(typeof ThreadPreview).toBe('function');
  });

  it('exports ThreadDetailPanel', () => {
    expect(ThreadDetailPanel).toBeDefined();
    expect(typeof ThreadDetailPanel).toBe('function');
  });
});
