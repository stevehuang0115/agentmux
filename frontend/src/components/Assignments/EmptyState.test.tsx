import React from 'react';
import { render, screen } from '@testing-library/react';
import { FolderOpen } from 'lucide-react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('should render icon, title, and description', () => {
    render(
      <EmptyState
        type="projects"
        icon={FolderOpen}
        title="No Projects Found"
        description="Create a project to get started."
      />
    );

    expect(screen.getByText('No Projects Found')).toBeInTheDocument();
    expect(screen.getByText('Create a project to get started.')).toBeInTheDocument();
  });

  it('should render the provided icon component', () => {
    const { container } = render(
      <EmptyState
        type="projects"
        icon={FolderOpen}
        title="No Projects Found"
        description="Create a project to get started."
      />
    );

    // Check that the icon is rendered by looking for its SVG
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  it('should apply correct CSS class', () => {
    const { container } = render(
      <EmptyState
        type="projects"
        icon={FolderOpen}
        title="No Projects Found"
        description="Create a project to get started."
      />
    );

    const emptyStateDiv = container.querySelector('.empty-state');
    expect(emptyStateDiv).toBeInTheDocument();
  });
});