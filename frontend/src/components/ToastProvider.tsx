import { useCallback, useRef, useState, type ReactNode } from "react";
import { ToastContext } from "./toastContext";

/** Всплывающие уведомления, как в прототипе (.toast): одно за раз, исчезает через 2,6 с. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Живая область есть всегда, чтобы экранный диктор зачитал появившийся текст */}
      <div role="status" aria-live="polite" className="sr-only">
        {toast?.text}
      </div>
      {toast && (
        <div key={toast.id} className="toast" aria-hidden="true">
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}
