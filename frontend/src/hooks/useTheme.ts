import { useCallback, useState } from "react";

const KEY = "nav-theme";

function systemDark() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/** Применяет сохранённую тему до первой отрисовки (вызывается из main.tsx). */
export function applySavedTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
  } catch {
    // localStorage недоступен — остаётся тема системы
  }
}

/** Переключатель светлой/тёмной темы. Хранится в localStorage — это UI-настройка. */
export function useTheme() {
  const [dark, setDark] = useState(() => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : systemDark();
  });

  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // не сохранили — тема всё равно переключится до перезагрузки
    }
    setDark(!dark);
  }, [dark]);

  return { dark, toggle };
}
