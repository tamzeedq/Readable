import { create } from 'zustand';
import { X } from 'lucide-react';
import './Notice.css';

interface Toast {
  id: number;
  message: string;
  tone: 'error' | 'info';
}

const useToasts = create<{ toasts: Toast[]; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let nextId = 1;

/** Show a transient notice from anywhere (no hook needed). */
export function notify(message: string, tone: Toast['tone'] = 'info', ms = 7000): void {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts.filter((t) => t.message !== message), { id, message, tone }].slice(-3) }));
  setTimeout(() => useToasts.getState().dismiss(id), ms);
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span className="toast-msg">{t.message}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <X size={15} strokeWidth={1.6} />
          </button>
        </div>
      ))}
    </div>
  );
}
