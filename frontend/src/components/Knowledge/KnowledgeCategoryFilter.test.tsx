/**
 * KnowledgeCategoryFilter Component Tests
 *
 * Tests for the category filter sidebar component that allows
 * selecting "All" or a specific document category.
 *
 * @module components/Knowledge/KnowledgeCategoryFilter.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeCategoryFilter } from './KnowledgeCategoryFilter';

describe('KnowledgeCategoryFilter', () => {
  const defaultProps = {
    categories: ['SOPs', 'Architecture', 'General'],
    selectedCategory: '',
    onCategoryChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the "All" button', () => {
      render(<KnowledgeCategoryFilter {...defaultProps} />);

      expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    });

    it('should render all category buttons', () => {
      render(<KnowledgeCategoryFilter {...defaultProps} />);

      expect(screen.getByRole('option', { name: 'SOPs' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Architecture' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'General' })).toBeInTheDocument();
    });

    it('should render the listbox role container', () => {
      render(<KnowledgeCategoryFilter {...defaultProps} />);

      expect(screen.getByRole('listbox', { name: /filter by category/i })).toBeInTheDocument();
    });

    it('should render correct number of options', () => {
      render(<KnowledgeCategoryFilter {...defaultProps} />);

      // "All" + 3 categories = 4 options
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
    });

    it('should render no category buttons when categories array is empty', () => {
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          categories={[]}
        />,
      );

      // Only "All" button should exist
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('should highlight "All" as selected when selectedCategory is empty string', () => {
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          selectedCategory=""
        />,
      );

      const allOption = screen.getByRole('option', { name: 'All' });
      expect(allOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should not highlight category options when "All" is selected', () => {
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          selectedCategory=""
        />,
      );

      const sopsOption = screen.getByRole('option', { name: 'SOPs' });
      const architectureOption = screen.getByRole('option', { name: 'Architecture' });
      const generalOption = screen.getByRole('option', { name: 'General' });

      expect(sopsOption).toHaveAttribute('aria-selected', 'false');
      expect(architectureOption).toHaveAttribute('aria-selected', 'false');
      expect(generalOption).toHaveAttribute('aria-selected', 'false');
    });

    it('should highlight the selected category', () => {
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          selectedCategory="Architecture"
        />,
      );

      const architectureOption = screen.getByRole('option', { name: 'Architecture' });
      expect(architectureOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should not highlight "All" when a specific category is selected', () => {
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          selectedCategory="SOPs"
        />,
      );

      const allOption = screen.getByRole('option', { name: 'All' });
      expect(allOption).toHaveAttribute('aria-selected', 'false');
    });

    it('should only highlight one category at a time', () => {
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          selectedCategory="General"
        />,
      );

      const allOption = screen.getByRole('option', { name: 'All' });
      const sopsOption = screen.getByRole('option', { name: 'SOPs' });
      const architectureOption = screen.getByRole('option', { name: 'Architecture' });
      const generalOption = screen.getByRole('option', { name: 'General' });

      expect(allOption).toHaveAttribute('aria-selected', 'false');
      expect(sopsOption).toHaveAttribute('aria-selected', 'false');
      expect(architectureOption).toHaveAttribute('aria-selected', 'false');
      expect(generalOption).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Interaction', () => {
    it('should call onCategoryChange with empty string when "All" is clicked', () => {
      const onCategoryChange = vi.fn();
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          selectedCategory="SOPs"
          onCategoryChange={onCategoryChange}
        />,
      );

      fireEvent.click(screen.getByRole('option', { name: 'All' }));

      expect(onCategoryChange).toHaveBeenCalledTimes(1);
      expect(onCategoryChange).toHaveBeenCalledWith('');
    });

    it('should call onCategoryChange with the category name when a category is clicked', () => {
      const onCategoryChange = vi.fn();
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          onCategoryChange={onCategoryChange}
        />,
      );

      fireEvent.click(screen.getByRole('option', { name: 'Architecture' }));

      expect(onCategoryChange).toHaveBeenCalledTimes(1);
      expect(onCategoryChange).toHaveBeenCalledWith('Architecture');
    });

    it('should call onCategoryChange with correct value for each category', () => {
      const onCategoryChange = vi.fn();
      render(
        <KnowledgeCategoryFilter
          {...defaultProps}
          onCategoryChange={onCategoryChange}
        />,
      );

      fireEvent.click(screen.getByRole('option', { name: 'SOPs' }));
      expect(onCategoryChange).toHaveBeenLastCalledWith('SOPs');

      fireEvent.click(screen.getByRole('option', { name: 'General' }));
      expect(onCategoryChange).toHaveBeenLastCalledWith('General');

      expect(onCategoryChange).toHaveBeenCalledTimes(2);
    });
  });
});
