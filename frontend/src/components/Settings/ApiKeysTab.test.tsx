/**
 * Tests for ApiKeysTab Component
 *
 * @module components/Settings/ApiKeysTab.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeysTab } from './ApiKeysTab';

// Mock useSettings hook
const mockUpdateSettings = vi.fn().mockResolvedValue({});
const mockUseSettings = vi.fn().mockReturnValue({
  settings: {
    general: { defaultRuntime: 'claude-code' as const },
    chat: {},
    skills: {},
    apiKeys: {
      global: {},
      runtimeOverrides: {},
      skillOverrides: {},
    },
  },
  updateSettings: mockUpdateSettings,
  isLoading: false,
  error: null,
});

vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock settings service
vi.mock('../../services/settings.service', () => ({
  settingsService: {
    testApiKey: vi.fn().mockResolvedValue({ valid: true }),
  },
}));

describe('ApiKeysTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({
      settings: {
        general: { defaultRuntime: 'claude-code' as const },
        chat: {},
        skills: {},
        apiKeys: {
          global: {},
          runtimeOverrides: {},
          skillOverrides: {},
        },
      },
      updateSettings: mockUpdateSettings,
      isLoading: false,
      error: null,
    });
  });

  it('should render the API Keys heading', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('API Keys')).toBeInTheDocument();
  });

  it('should render global key sections for all providers', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('should render runtime override sections', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('Runtime Overrides')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Gemini CLI')).toBeInTheDocument();
    expect(screen.getByText('Codex CLI')).toBeInTheDocument();
    expect(screen.getByText('Crewly Agent')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseSettings.mockReturnValue({
      settings: null,
      updateSettings: mockUpdateSettings,
      isLoading: true,
      error: null,
    });
    render(<ApiKeysTab />);
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseSettings.mockReturnValue({
      settings: null,
      updateSettings: mockUpdateSettings,
      isLoading: false,
      error: 'Failed to load settings',
    });
    render(<ApiKeysTab />);
    expect(screen.getByText('Failed to load settings')).toBeInTheDocument();
  });

  it('should render save button', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('should render test buttons for each provider', () => {
    render(<ApiKeysTab />);
    const testButtons = screen.getAllByText('Test');
    expect(testButtons.length).toBe(3); // One per global provider
  });

  it('should show env var hints', () => {
    render(<ApiKeysTab />);
    expect(screen.getByText('GOOGLE_GENERATIVE_AI_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('ANTHROPIC_API_KEY')).toBeInTheDocument();
    expect(screen.getByText('OPENAI_API_KEY')).toBeInTheDocument();
  });

  it('should render with existing global keys', () => {
    mockUseSettings.mockReturnValue({
      settings: {
        general: { defaultRuntime: 'claude-code' as const },
        chat: {},
        skills: {},
        apiKeys: {
          global: { gemini: '••••••••1234' },
          runtimeOverrides: {},
          skillOverrides: {},
        },
      },
      updateSettings: mockUpdateSettings,
      isLoading: false,
      error: null,
    });
    render(<ApiKeysTab />);
    // Should show "Saved" status for configured key
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('should show "Not set" for unconfigured keys', () => {
    render(<ApiKeysTab />);
    const notSetElements = screen.getAllByText('Not set');
    expect(notSetElements.length).toBe(3);
  });
});
