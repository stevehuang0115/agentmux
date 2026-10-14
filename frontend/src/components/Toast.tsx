/**
 * Toast Notification Component
 *
 * Renders a stack of ephemeral toast notifications in the bottom-right corner.
 * Each toast shows a message with a colored indicator based on type (success,
 * error, info) and a dismiss button.
 *
 * @module components/Toast
 */

import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { IconButton } from '@crewly/ui/Button';
import type { Toast as ToastItem } from '../hooks/useToast';

/** Props for the ToastContainer component */
interface ToastContainerProps {
  /** Array of active toast notifications */
  toasts: ToastItem[];
  /** Callback to dismiss a toast by ID */
  onDismiss: (id: string) => void;
}

/** Icon chip per type: the state colour says what happened, the icon says it again. */
const typeChip: Record<ToastItem['type'], { icon: LucideIcon; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-success-soft text-success' },
  error: { icon: AlertCircle, classes: 'bg-danger-soft text-danger' },
  info: { icon: Info, classes: 'bg-primary-soft text-primary-text' },
};

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="log" aria-live="polite">
      {toasts.map((toast) => {
        const { icon: Icon, classes } = typeChip[toast.type];
        return (
        <div
          key={toast.id}
          data-testid={`toast-${toast.type}`}
          className="cw-glass-strong flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${classes}`} aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-text">{toast.message}</span>
          <IconButton
            icon={X}
            size="xs"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0"
            aria-label="Dismiss notification"
          />
        </div>
        );
      })}
    </div>
  );
}
