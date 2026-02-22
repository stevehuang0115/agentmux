/**
 * Toast Notification Hook
 *
 * Manages a queue of ephemeral toast notifications with automatic dismissal.
 * Each toast has a type (success, error, info) and auto-dismisses after a
 * configurable duration.
 *
 * @module hooks/useToast
 */

import { useState, useCallback, useRef } from 'react';

/** Supported toast notification types */
export type ToastType = 'success' | 'error' | 'info';

/** A single toast notification entry */
export interface Toast {
  /** Unique identifier */
  id: string;
  /** Display message */
  message: string;
  /** Visual type (success, error, info) */
  type: ToastType;
}

/** Auto-dismiss duration in milliseconds */
const TOAST_DURATION = 4000;

/**
 * Hook for managing toast notifications.
 *
 * Returns the current list of toasts, a function to add new toasts,
 * and a function to manually dismiss a toast by ID.
 *
 * @returns Object with toasts array, addToast, and dismissToast functions
 *
 * @example
 * ```tsx
 * const { toasts, addToast, dismissToast } = useToast();
 * addToast('Installed successfully', 'success');
 * ```
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  /**
   * Add a new toast notification.
   *
   * @param message - The message to display
   * @param type - The toast type (success, error, info)
   */
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`;
    const toast: Toast = { id, message, type };

    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  /**
   * Manually dismiss a toast by its ID.
   *
   * @param id - The toast ID to remove
   */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
