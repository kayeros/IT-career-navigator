import { createContext, useContext } from "react";

/** Показать короткое уведомление. Вне ToastProvider (например, в тестах страниц) — ничего не делает. */
export const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);
