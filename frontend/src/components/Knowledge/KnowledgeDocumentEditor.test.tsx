/**
 * KnowledgeDocumentEditor Component Tests
 *
 * Tests for the document editor form component that supports
 * creating new documents and editing existing ones.
 *
 * @module components/Knowledge/KnowledgeDocumentEditor.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeDocumentEditor } from './KnowledgeDocumentEditor';
import type { KnowledgeDocument } from '../../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Save: () => <svg data-testid="save-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

/**
 * Create a mock knowledge document for testing in edit mode.
 *
 * @param overrides - Partial overrides for the default mock document
 * @returns A complete KnowledgeDocument object
 */
function createMockDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: 'doc-1',
    title: 'Existing Document',
    category: 'Architecture',
    tags: ['backend', 'api'],
    content: 'Existing document content goes here.',
    scope: 'global',
    createdBy: 'admin',
    updatedBy: 'editor',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-10T14:30:00Z',
    ...overrides,
  };
}

describe('KnowledgeDocumentEditor', () => {
  const defaultCreateProps = {
    document: null,
    categories: ['SOPs', 'Architecture'],
    saving: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  const defaultEditProps = {
    ...defaultCreateProps,
    document: createMockDocument(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Fields', () => {
    it('should render the title input field', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    it('should render the category select field', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByLabelText('Category')).toBeInTheDocument();
    });

    it('should render the tags input field', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('should render the content textarea', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    });

    it('should render title placeholder text', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByPlaceholderText('Document title')).toBeInTheDocument();
    });

    it('should render tags placeholder text', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByPlaceholderText('api, backend, auth')).toBeInTheDocument();
    });

    it('should render content placeholder text', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(
        screen.getByPlaceholderText('Write your document content in Markdown...'),
      ).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render the Save button', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByTestId('save-icon')).toBeInTheDocument();
    });

    it('should render the Cancel button', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('should call onCancel when Cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(
        <KnowledgeDocumentEditor
          {...defaultCreateProps}
          onCancel={onCancel}
        />,
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Create Mode', () => {
    it('should show "New Document" title when document is null', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      expect(screen.getByText('New Document')).toBeInTheDocument();
    });

    it('should start with empty title field in create mode', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      expect(titleInput.value).toBe('');
    });

    it('should start with empty content field in create mode', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const contentTextarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      expect(contentTextarea.value).toBe('');
    });

    it('should start with empty tags field in create mode', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const tagsInput = screen.getByLabelText(/tags/i) as HTMLInputElement;
      expect(tagsInput.value).toBe('');
    });

    it('should default category to "General" in create mode', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
      expect(categorySelect.value).toBe('General');
    });
  });

  describe('Edit Mode', () => {
    it('should show "Edit Document" title when document is provided', () => {
      render(<KnowledgeDocumentEditor {...defaultEditProps} />);

      expect(screen.getByText('Edit Document')).toBeInTheDocument();
    });

    it('should pre-fill the title field with the document title', () => {
      render(<KnowledgeDocumentEditor {...defaultEditProps} />);

      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      expect(titleInput.value).toBe('Existing Document');
    });

    it('should pre-fill the content field with the document content', () => {
      render(<KnowledgeDocumentEditor {...defaultEditProps} />);

      const contentTextarea = screen.getByLabelText(/content/i) as HTMLTextAreaElement;
      expect(contentTextarea.value).toBe('Existing document content goes here.');
    });

    it('should pre-fill the category field with the document category', () => {
      render(<KnowledgeDocumentEditor {...defaultEditProps} />);

      const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
      expect(categorySelect.value).toBe('Architecture');
    });

    it('should pre-fill the tags field with comma-separated tags', () => {
      render(<KnowledgeDocumentEditor {...defaultEditProps} />);

      const tagsInput = screen.getByLabelText(/tags/i) as HTMLInputElement;
      expect(tagsInput.value).toBe('backend, api');
    });
  });

  describe('Form Validation', () => {
    it('should disable Save button when title is empty', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).toBeDisabled();
    });

    it('should disable Save button when content is empty', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      // Fill title but leave content empty
      const titleInput = screen.getByLabelText('Title');
      fireEvent.change(titleInput, { target: { value: 'A Title' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).toBeDisabled();
    });

    it('should disable Save button when both title and content are empty', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when both title and content have values', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const titleInput = screen.getByLabelText('Title');
      const contentTextarea = screen.getByLabelText(/content/i);

      fireEvent.change(titleInput, { target: { value: 'My Document' } });
      fireEvent.change(contentTextarea, { target: { value: 'Some content here' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).not.toBeDisabled();
    });

    it('should disable Save button when title is only whitespace', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const titleInput = screen.getByLabelText('Title');
      const contentTextarea = screen.getByLabelText(/content/i);

      fireEvent.change(titleInput, { target: { value: '   ' } });
      fireEvent.change(contentTextarea, { target: { value: 'Some content' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).toBeDisabled();
    });

    it('should disable Save button when content is only whitespace', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const titleInput = screen.getByLabelText('Title');
      const contentTextarea = screen.getByLabelText(/content/i);

      fireEvent.change(titleInput, { target: { value: 'A Title' } });
      fireEvent.change(contentTextarea, { target: { value: '   ' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button in edit mode since fields are pre-filled', () => {
      render(<KnowledgeDocumentEditor {...defaultEditProps} />);

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('should call onSave with form data when submitted', () => {
      const onSave = vi.fn();
      render(
        <KnowledgeDocumentEditor
          {...defaultCreateProps}
          onSave={onSave}
        />,
      );

      const titleInput = screen.getByLabelText('Title');
      const contentTextarea = screen.getByLabelText(/content/i);
      const tagsInput = screen.getByLabelText(/tags/i);

      fireEvent.change(titleInput, { target: { value: 'New Guide' } });
      fireEvent.change(contentTextarea, { target: { value: 'Guide content here' } });
      fireEvent.change(tagsInput, { target: { value: 'guide, help' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        title: 'New Guide',
        content: 'Guide content here',
        category: 'General',
        tags: ['guide', 'help'],
      });
    });

    it('should call onSave with pre-filled data in edit mode', () => {
      const onSave = vi.fn();
      render(
        <KnowledgeDocumentEditor
          {...defaultEditProps}
          onSave={onSave}
        />,
      );

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        title: 'Existing Document',
        content: 'Existing document content goes here.',
        category: 'Architecture',
        tags: ['backend', 'api'],
      });
    });

    it('should filter out empty tags from submission', () => {
      const onSave = vi.fn();
      render(
        <KnowledgeDocumentEditor
          {...defaultCreateProps}
          onSave={onSave}
        />,
      );

      const titleInput = screen.getByLabelText('Title');
      const contentTextarea = screen.getByLabelText(/content/i);
      const tagsInput = screen.getByLabelText(/tags/i);

      fireEvent.change(titleInput, { target: { value: 'Title' } });
      fireEvent.change(contentTextarea, { target: { value: 'Content' } });
      fireEvent.change(tagsInput, { target: { value: 'tag1, , tag2, , ' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['tag1', 'tag2'],
        }),
      );
    });

    it('should submit empty tags array when tags input is empty', () => {
      const onSave = vi.fn();
      render(
        <KnowledgeDocumentEditor
          {...defaultCreateProps}
          onSave={onSave}
        />,
      );

      const titleInput = screen.getByLabelText('Title');
      const contentTextarea = screen.getByLabelText(/content/i);

      fireEvent.change(titleInput, { target: { value: 'Title' } });
      fireEvent.change(contentTextarea, { target: { value: 'Content' } });

      const saveButton = screen.getByText('Save').closest('button') as HTMLButtonElement;
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [],
        }),
      );
    });
  });

  describe('Saving State', () => {
    it('should show "Saving..." text when saving is true', () => {
      render(
        <KnowledgeDocumentEditor
          {...defaultEditProps}
          saving={true}
        />,
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show "Save" text when saving is false', () => {
      render(
        <KnowledgeDocumentEditor
          {...defaultEditProps}
          saving={false}
        />,
      );

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should disable Save button when saving is true', () => {
      render(
        <KnowledgeDocumentEditor
          {...defaultEditProps}
          saving={true}
        />,
      );

      const saveButton = screen.getByText('Saving...').closest('button') as HTMLButtonElement;
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Category Options', () => {
    it('should render categories from props merged with defaults', () => {
      render(
        <KnowledgeDocumentEditor
          {...defaultCreateProps}
          categories={['Custom Category']}
        />,
      );

      const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
      const options = Array.from(categorySelect.options).map((opt) => opt.value);

      // Should include both default categories and custom ones
      expect(options).toContain('General');
      expect(options).toContain('SOPs');
      expect(options).toContain('Custom Category');
    });

    it('should allow selecting a different category', () => {
      render(<KnowledgeDocumentEditor {...defaultCreateProps} />);

      const categorySelect = screen.getByLabelText('Category');
      fireEvent.change(categorySelect, { target: { value: 'SOPs' } });

      expect((categorySelect as HTMLSelectElement).value).toBe('SOPs');
    });

    it('should deduplicate categories from props and defaults', () => {
      render(
        <KnowledgeDocumentEditor
          {...defaultCreateProps}
          categories={['General', 'SOPs']}
        />,
      );

      const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
      const generalOptions = Array.from(categorySelect.options).filter(
        (opt) => opt.value === 'General',
      );

      // General should appear only once even though it's in both defaults and props
      expect(generalOptions).toHaveLength(1);
    });
  });
});
