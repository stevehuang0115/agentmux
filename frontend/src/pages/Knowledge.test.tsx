/**
 * Knowledge Page Tests
 *
 * Tests for the Knowledge page component including rendering,
 * scope toggle, document list loading, and the "New Document" button.
 *
 * @module pages/Knowledge.test
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Knowledge } from './Knowledge';

// Mock lucide-react icons used by Knowledge page and its children
vi.mock('lucide-react', () => ({
  BookOpen: () => <svg data-testid="book-open-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  Globe: () => <svg data-testid="globe-icon" />,
  FolderOpen: () => <svg data-testid="folder-open-icon" />,
  Search: () => <svg data-testid="search-icon" />,
  FileText: () => <svg data-testid="file-text-icon" />,
  Edit3: () => <svg data-testid="edit-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  User: () => <svg data-testid="user-icon" />,
  Save: () => <svg data-testid="save-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

// Mock api service
const mockGetKnowledgeDocuments = vi.fn();
const mockGetKnowledgeCategories = vi.fn();
const mockGetProjects = vi.fn();
const mockGetKnowledgeDocument = vi.fn();
const mockCreateKnowledgeDocument = vi.fn();
const mockUpdateKnowledgeDocument = vi.fn();
const mockDeleteKnowledgeDocument = vi.fn();

vi.mock('../services/api.service', () => ({
  apiService: {
    getKnowledgeDocuments: (...args: unknown[]) => mockGetKnowledgeDocuments(...args),
    getKnowledgeCategories: (...args: unknown[]) => mockGetKnowledgeCategories(...args),
    getProjects: (...args: unknown[]) => mockGetProjects(...args),
    getKnowledgeDocument: (...args: unknown[]) => mockGetKnowledgeDocument(...args),
    createKnowledgeDocument: (...args: unknown[]) => mockCreateKnowledgeDocument(...args),
    updateKnowledgeDocument: (...args: unknown[]) => mockUpdateKnowledgeDocument(...args),
    deleteKnowledgeDocument: (...args: unknown[]) => mockDeleteKnowledgeDocument(...args),
  },
}));

/**
 * Test wrapper providing MemoryRouter for react-router hooks.
 *
 * @param props - Component props with children
 * @returns Wrapped component JSX
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    {children}
  </MemoryRouter>
);

describe('Knowledge Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKnowledgeDocuments.mockResolvedValue([]);
    mockGetKnowledgeCategories.mockResolvedValue(['SOPs', 'General']);
    mockGetProjects.mockResolvedValue([]);
    mockGetKnowledgeDocument.mockResolvedValue(null);
    mockCreateKnowledgeDocument.mockResolvedValue('new-doc-id');
    mockUpdateKnowledgeDocument.mockResolvedValue(undefined);
    mockDeleteKnowledgeDocument.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render the Knowledge heading', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByText('Knowledge')).toBeInTheDocument();
    });

    it('should render the BookOpen icon', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByTestId('book-open-icon')).toBeInTheDocument();
    });

    it('should render the scope toggle with Global and Project buttons', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByRole('tab', { name: /global/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /project/i })).toBeInTheDocument();
    });

    it('should render the New Document button', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByText('New Document')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('should render the search input', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Make the documents request never resolve to keep loading state
      mockGetKnowledgeDocuments.mockReturnValue(new Promise(() => {}));
      mockGetKnowledgeCategories.mockReturnValue(new Promise(() => {}));

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByText('Loading documents...')).toBeInTheDocument();
    });

    it('should show loading status role', () => {
      mockGetKnowledgeDocuments.mockReturnValue(new Promise(() => {}));
      mockGetKnowledgeCategories.mockReturnValue(new Promise(() => {}));

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Document List', () => {
    it('should render document list after loading', async () => {
      mockGetKnowledgeDocuments.mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Getting Started Guide',
          category: 'Onboarding',
          tags: ['intro'],
          preview: 'Welcome to the team...',
          scope: 'global',
          createdBy: 'admin',
          updatedBy: 'admin',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-15T00:00:00Z',
        },
        {
          id: 'doc-2',
          title: 'API Reference',
          category: 'Architecture',
          tags: ['api'],
          preview: 'This document describes...',
          scope: 'global',
          createdBy: 'admin',
          updatedBy: 'admin',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-16T00:00:00Z',
        },
      ]);

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
        expect(screen.getByText('API Reference')).toBeInTheDocument();
      });
    });

    it('should show empty state when no documents found', async () => {
      mockGetKnowledgeDocuments.mockResolvedValue([]);

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('No documents found')).toBeInTheDocument();
      });
    });

    it('should render category filter buttons after loading', async () => {
      mockGetKnowledgeCategories.mockResolvedValue(['SOPs', 'Architecture', 'General']);

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('SOPs')).toBeInTheDocument();
        expect(screen.getByText('Architecture')).toBeInTheDocument();
        expect(screen.getByText('General')).toBeInTheDocument();
      });
    });

    it('should render the All category filter button', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when documents fail to load', async () => {
      mockGetKnowledgeDocuments.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
      });
    });
  });

  describe('Default View', () => {
    it('should show placeholder text when no document is selected', async () => {
      mockGetKnowledgeDocuments.mockResolvedValue([]);

      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText('Select a document to view')).toBeInTheDocument();
        expect(screen.getByText('or create a new one')).toBeInTheDocument();
      });
    });
  });

  describe('API Calls', () => {
    it('should call getProjects on mount', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(mockGetProjects).toHaveBeenCalled();
      });
    });

    it('should call getKnowledgeDocuments on mount', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(mockGetKnowledgeDocuments).toHaveBeenCalled();
      });
    });

    it('should call getKnowledgeCategories on mount', async () => {
      render(
        <TestWrapper>
          <Knowledge />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(mockGetKnowledgeCategories).toHaveBeenCalled();
      });
    });
  });
});
