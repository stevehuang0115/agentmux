/**
 * KnowledgeDocumentViewer Component Tests
 *
 * Tests for the document viewer component that displays the full
 * content of a knowledge document with edit and delete actions.
 *
 * @module components/Knowledge/KnowledgeDocumentViewer.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeDocumentViewer } from './KnowledgeDocumentViewer';
import type { KnowledgeDocument } from '../../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Edit3: () => <svg data-testid="edit-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  User: () => <svg data-testid="user-icon" />,
}));

/**
 * Create a mock knowledge document for testing.
 *
 * @param overrides - Partial overrides for the default mock document
 * @returns A complete KnowledgeDocument object
 */
function createMockDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: 'doc-1',
    title: 'Test Document Title',
    category: 'Architecture',
    tags: ['backend', 'api'],
    content: 'This is the full document content in markdown format.',
    scope: 'global',
    createdBy: 'admin',
    updatedBy: 'editor',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-10T14:30:00Z',
    ...overrides,
  };
}

describe('KnowledgeDocumentViewer', () => {
  const defaultProps = {
    document: createMockDocument(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Document Content', () => {
    it('should render the document title', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByText('Test Document Title')).toBeInTheDocument();
    });

    it('should render the document content', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(
        screen.getByText('This is the full document content in markdown format.'),
      ).toBeInTheDocument();
    });

    it('should render the document category', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByText('Architecture')).toBeInTheDocument();
    });

    it('should render the document creator', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    it('should render the User icon for author', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
    });

    it('should render the Clock icon for timestamp', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });
  });

  describe('Tags', () => {
    it('should render document tags', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('api')).toBeInTheDocument();
    });

    it('should render multiple tags', () => {
      const doc = createMockDocument({
        tags: ['react', 'typescript', 'testing', 'frontend'],
      });
      render(
        <KnowledgeDocumentViewer
          {...defaultProps}
          document={doc}
        />,
      );

      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
    });

    it('should not render tags section when document has no tags', () => {
      const doc = createMockDocument({ tags: [] });
      const { container } = render(
        <KnowledgeDocumentViewer
          {...defaultProps}
          document={doc}
        />,
      );

      // The tag container uses rounded-full class for tag elements
      const tagElements = container.querySelectorAll('.rounded-full');
      expect(tagElements).toHaveLength(0);
    });
  });

  describe('Action Buttons', () => {
    it('should render the Edit button', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    });

    it('should render the Delete button', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });

    it('should render Edit button with accessible label', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /edit document/i }),
      ).toBeInTheDocument();
    });

    it('should render Delete button with accessible label', () => {
      render(<KnowledgeDocumentViewer {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /delete document/i }),
      ).toBeInTheDocument();
    });

    it('should call onEdit when Edit button is clicked', () => {
      const onEdit = vi.fn();
      render(
        <KnowledgeDocumentViewer
          {...defaultProps}
          onEdit={onEdit}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /edit document/i }));

      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete when Delete button is clicked', () => {
      const onDelete = vi.fn();
      render(
        <KnowledgeDocumentViewer
          {...defaultProps}
          onDelete={onDelete}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /delete document/i }));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Different Documents', () => {
    it('should render a different document correctly', () => {
      const doc = createMockDocument({
        title: 'Deployment Runbook',
        content: 'Step 1: Pull the latest code from main branch.',
        category: 'Runbooks',
        tags: ['devops', 'deployment'],
        createdBy: 'ops-lead',
      });

      render(
        <KnowledgeDocumentViewer
          {...defaultProps}
          document={doc}
        />,
      );

      expect(screen.getByText('Deployment Runbook')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Pull the latest code from main branch.')).toBeInTheDocument();
      expect(screen.getByText('Runbooks')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('deployment')).toBeInTheDocument();
      expect(screen.getByText('ops-lead')).toBeInTheDocument();
    });
  });
});
