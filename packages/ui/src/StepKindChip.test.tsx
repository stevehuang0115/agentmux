import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STEP_KINDS, StepKindChip } from './StepKindChip';

describe('StepKindChip', () => {
  it('covers the seven kinds, each with its own class and an accessible name', () => {
    expect(STEP_KINDS.map((k) => k.kind)).toEqual(['read', 'edit', 'run', 'find', 'browse', 'delegate', 'think']);
    for (const { kind, label } of STEP_KINDS) {
      const { unmount } = render(<StepKindChip kind={kind} />);
      const chip = screen.getByRole('img', { name: label });
      expect(chip).toHaveClass(`cw-kind-${kind}`);
      expect(chip.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('shows the label when asked and accepts a translated one', () => {
    render(<StepKindChip kind="delegate" showLabel label="Handed to Maya" />);
    expect(screen.getByText('Handed to Maya')).toBeInTheDocument();
  });
});
