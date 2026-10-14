import React from 'react';
import { Eye, GitBranch, Globe, Pencil, Search, Sparkles, Terminal, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

/** What an agent is doing in one step of its work. */
export type StepKind = 'read' | 'edit' | 'run' | 'find' | 'browse' | 'delegate' | 'think';

/** Every kind, in display order, with its default label and icon. */
export const STEP_KINDS: ReadonlyArray<{ kind: StepKind; label: string; icon: LucideIcon }> = [
  { kind: 'read', label: 'Read', icon: Eye },
  { kind: 'edit', label: 'Edit', icon: Pencil },
  { kind: 'run', label: 'Run', icon: Terminal },
  { kind: 'find', label: 'Find', icon: Search },
  { kind: 'browse', label: 'Browse', icon: Globe },
  { kind: 'delegate', label: 'Delegate', icon: GitBranch },
  { kind: 'think', label: 'Think', icon: Sparkles },
];

/**
 * Whole class names, not built from the kind: Tailwind (v3 purge, v4 scan)
 * only keeps classes it can read as literal strings.
 */
const KIND_CLASS: Record<StepKind, string> = {
  read: 'cw-kind cw-kind-read',
  edit: 'cw-kind cw-kind-edit',
  run: 'cw-kind cw-kind-run',
  find: 'cw-kind cw-kind-find',
  browse: 'cw-kind cw-kind-browse',
  delegate: 'cw-kind cw-kind-delegate',
  think: 'cw-kind cw-kind-think',
};

export interface StepKindChipProps {
  /** Which kind of step this is: sets the colour and the icon. */
  kind: StepKind;
  /** Accessible/visible name; defaults to the English kind name. */
  label?: string;
  /** Show the label next to the icon (otherwise the icon alone, named for assistive tech). */
  showLabel?: boolean;
  className?: string;
}

/**
 * A small coloured chip that names the kind of an agent step (read, edit,
 * run, find, browse, delegate, think). Colour AND icon carry the kind, so it
 * does not rely on colour alone. Colours come from the `--kind-*` tokens and
 * follow the theme.
 *
 * @example
 * ```tsx
 * <StepKindChip kind="run" />
 * <StepKindChip kind="delegate" showLabel label="Handed to Maya" />
 * ```
 */
export const StepKindChip: React.FC<StepKindChipProps> = ({ kind, label, showLabel = false, className }) => {
  const def = STEP_KINDS.find((k) => k.kind === kind) ?? STEP_KINDS[0];
  const Icon = def.icon;
  const text = label ?? def.label;
  return (
    <span
      className={cn(
        KIND_CLASS[def.kind],
        showLabel && 'h-auto w-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        className,
      )}
      role={showLabel ? undefined : 'img'}
      aria-label={showLabel ? undefined : text}
      title={showLabel ? undefined : text}
      data-kind={def.kind}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {showLabel && <span className="ml-1">{text}</span>}
    </span>
  );
};

StepKindChip.displayName = 'StepKindChip';
