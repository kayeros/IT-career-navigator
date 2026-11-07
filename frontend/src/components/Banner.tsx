import type { ReactNode } from "react";

/** Плашка из прототипа: info — подсказка, error — ошибка. */
export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  if (tone === "error") {
    return (
      <div className="warn" role="alert">
        <b>!</b>
        <span>{children}</span>
      </div>
    );
  }
  return (
    <div className="banner info fs-14" role="status">
      {children}
    </div>
  );
}
