import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default message', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading Crewly...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const customMessage = 'Custom loading message';
    render(<LoadingSpinner message={customMessage} />);
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-spinner-class';
    const { container } = render(<LoadingSpinner className={customClass} />);
    const outerContainer = container.firstChild;
    expect(outerContainer).toHaveClass(customClass);
  });

  it('has spinner animation element', () => {
    render(<LoadingSpinner />);
    const spinnerElement = document.querySelector('.animate-spin');
    expect(spinnerElement).toBeInTheDocument();
  });
});