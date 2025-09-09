import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from './Button';

describe('Button Component', () => {
  describe('Basic Rendering', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should apply default variant and size classes', () => {
      render(<Button>Default Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-md');
    });

    it('should apply custom className', () => {
      render(<Button className="custom-class">Custom Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    const variants = ['primary', 'secondary', 'success', 'warning', 'danger', 'ghost', 'outline'] as const;

    variants.forEach(variant => {
      it(`should render ${variant} variant correctly`, () => {
        render(<Button variant={variant}>{variant} Button</Button>);
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`btn-${variant}`);
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach(size => {
      it(`should render ${size} size correctly`, () => {
        render(<Button size={size}>{size} Button</Button>);
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`btn-${size}`);
      });
    });
  });

  describe('Icons', () => {
    it('should render icon on the left by default', () => {
      render(
        <Button icon={Plus}>
          Add Item
        </Button>
      );
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('.btn-icon-left');
      expect(icon).toBeInTheDocument();
    });

    it('should render icon on the right when specified', () => {
      render(
        <Button icon={Plus} iconPosition="right">
          Add Item
        </Button>
      );
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('.btn-icon-right');
      expect(icon).toBeInTheDocument();
    });

    it('should not render icon when loading', () => {
      render(
        <Button icon={Plus} loading>
          Loading Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button.querySelector('.btn-icon')).not.toBeInTheDocument();
      expect(button.querySelector('.btn-spinner')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render spinner when loading', () => {
      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-loading');
      expect(button.querySelector('.btn-spinner')).toBeInTheDocument();
    });

    it('should disable button when loading', () => {
      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should apply loading text class when loading', () => {
      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      const textSpan = button.querySelector('.btn-text-loading');
      expect(textSpan).toBeInTheDocument();
      expect(textSpan).toHaveTextContent('Loading Button');
    });

    it('should apply normal text class when not loading', () => {
      render(<Button>Normal Button</Button>);
      
      const button = screen.getByRole('button');
      const textSpan = button.querySelector('.btn-text');
      expect(textSpan).toBeInTheDocument();
      expect(textSpan).toHaveTextContent('Normal Button');
    });
  });

  describe('Disabled State', () => {
    it('should disable button when disabled prop is true', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should disable button when loading even if disabled is false', () => {
      render(<Button disabled={false} loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Full Width', () => {
    it('should apply full width class when fullWidth is true', () => {
      render(<Button fullWidth>Full Width Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-full-width');
    });

    it('should not apply full width class by default', () => {
      render(<Button>Normal Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('btn-full-width');
    });
  });

  describe('Event Handling', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when button is disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when button is loading', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should support other event handlers', () => {
      const handleMouseOver = vi.fn();
      const handleFocus = vi.fn();
      
      render(
        <Button onMouseOver={handleMouseOver} onFocus={handleFocus}>
          Interactive Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      
      fireEvent.mouseOver(button);
      expect(handleMouseOver).toHaveBeenCalledTimes(1);
      
      fireEvent.focus(button);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTML Attributes', () => {
    it('should pass through other HTML attributes', () => {
      render(
        <Button 
          type="submit" 
          id="custom-button" 
          data-testid="test-button"
          aria-label="Custom button"
        >
          Custom Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('id', 'custom-button');
      expect(button).toHaveAttribute('data-testid', 'test-button');
      expect(button).toHaveAttribute('aria-label', 'Custom button');
    });
  });

  describe('Complex Combinations', () => {
    it('should handle multiple props correctly', () => {
      render(
        <Button 
          variant="success"
          size="lg"
          icon={Plus}
          iconPosition="right"
          fullWidth
          className="custom-class"
        >
          Complex Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'btn',
        'btn-success',
        'btn-lg',
        'btn-full-width',
        'custom-class'
      );
      expect(button.querySelector('.btn-icon-right')).toBeInTheDocument();
    });

    it('should prioritize loading state over other states', () => {
      render(
        <Button 
          variant="primary"
          icon={Plus}
          loading
          disabled={false}
        >
          Loading Priority Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('btn-loading');
      expect(button.querySelector('.btn-spinner')).toBeInTheDocument();
      expect(button.querySelector('.btn-icon')).not.toBeInTheDocument();
    });
  });
});

describe('IconButton Component', () => {
  describe('Basic Rendering', () => {
    it('should render icon button with icon', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Add item');
      expect(button).toHaveClass('btn-icon-only');
    });

    it('should apply default ghost variant', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-ghost');
    });

    it('should apply custom variant', () => {
      render(<IconButton icon={Plus} variant="primary" aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-primary');
    });

    it('should apply default medium size', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-md');
    });

    it('should apply custom size', () => {
      render(<IconButton icon={Plus} size="sm" aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-sm');
    });
  });

  describe('Icon Rendering', () => {
    it('should render the provided icon', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render different icons correctly', () => {
      const { rerender } = render(<IconButton icon={Plus} aria-label="Add item" />);
      
      let button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
      
      rerender(<IconButton icon={Trash2} aria-label="Delete item" />);
      
      button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Delete item');
    });
  });

  describe('Accessibility', () => {
    it('should require aria-label prop', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Add item');
    });

    it('should be focusable', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should support additional ARIA attributes', () => {
      render(
        <IconButton 
          icon={Plus} 
          aria-label="Add item" 
          aria-expanded="false"
          aria-haspopup="true"
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'true');
    });
  });

  describe('Event Handling', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<IconButton icon={Plus} onClick={handleClick} aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<IconButton icon={Plus} onClick={handleClick} disabled aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('should handle loading state', () => {
      render(<IconButton icon={Plus} loading aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('btn-loading');
    });

    it('should handle disabled state', () => {
      render(<IconButton icon={Plus} disabled aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Custom Classes', () => {
    it('should apply custom className along with icon-only class', () => {
      render(<IconButton icon={Plus} className="custom-icon-btn" aria-label="Add item" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-icon-only', 'custom-icon-btn');
    });
  });

  describe('Button Props Inheritance', () => {
    it('should pass through other button props', () => {
      render(
        <IconButton 
          icon={Plus} 
          aria-label="Add item"
          type="submit"
          id="icon-button"
          data-testid="test-icon-button"
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('id', 'icon-button');
      expect(button).toHaveAttribute('data-testid', 'test-icon-button');
    });
  });
});