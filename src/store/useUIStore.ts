import { create } from 'zustand';

export type ToastKind = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  createdAt: number;
}

interface UIState {
  toasts: Toast[];
  addToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  addToast: (message, kind = 'info', durationMs = 4000) => {
    const id = nextToastId++;
    const toast: Toast = { id, message, kind, createdAt: Date.now() };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    
    setTimeout(() => {
      get().dismissToast(id);
    }, durationMs);
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));

// BUG-013 FIX: Global error handler that surfaces issues to the user
export function installGlobalErrorHandler() {
  if (typeof window === 'undefined') return;
  if ((window as any).__heatRushErrorHandlerInstalled) return;
  (window as any).__heatRushErrorHandlerInstalled = true;

  const showError = (message: string) => {
    try {
      useUIStore.getState().addToast(message, 'error', 6000);
    } catch {
      // last-resort fallback: console
      console.error('[HeatRush]', message);
    }
  };

  window.addEventListener('error', (event) => {
    const msg = event?.error?.message || event?.message || 'Unexpected error';
    showError(`Error: ${msg}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : 'Network or async error');
    showError(`Async error: ${msg}`);
    // Prevent the default noisy console log spam in dev
    event.preventDefault?.();
  });
}
