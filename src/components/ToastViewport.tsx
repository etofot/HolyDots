import { useUIStore, type ToastKind } from '../store/useUIStore';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

const ICONS: Record<ToastKind, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const STYLES: Record<ToastKind, { bg: string; border: string; text: string; iconColor: string }> = {
  error:   { bg: 'bg-red-900/95',    border: 'border-red-500',   text: 'text-red-100',  iconColor: '#FF5555' },
  warning: { bg: 'bg-amber-900/95',  border: 'border-amber-500', text: 'text-amber-100', iconColor: '#FFB000' },
  info:    { bg: 'bg-blue-900/95',   border: 'border-blue-500',  text: 'text-blue-100', iconColor: '#5AAEFF' },
  success: { bg: 'bg-green-900/95',  border: 'border-green-500', text: 'text-green-100', iconColor: '#55DD55' },
};

export function ToastViewport() {
  const { toasts, dismissToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[90vw]">
      {toasts.map(t => {
        const Icon = ICONS[t.kind];
        const s = STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`${s.bg} ${s.border} ${s.text} border-2 rounded-lg px-4 py-2 flex items-center gap-3 shadow-2xl pointer-events-auto animate-[slideIn_0.3s_ease-out] min-w-[280px] max-w-md`}
            role="alert"
            onClick={() => dismissToast(t.id)}
          >
            <Icon size={20} color={s.iconColor} />
            <span className="text-sm font-bold flex-1 break-words">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
