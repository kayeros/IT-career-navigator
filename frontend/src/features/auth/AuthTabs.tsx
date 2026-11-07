import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

/** Переключатель «Регистрация / Вход» над формой, как в прототипе. ?next= сохраняется. */
export function AuthTabs({
  active,
  children,
}: {
  active: "register" | "login";
  children: ReactNode;
}) {
  const { search } = useLocation();
  return (
    <div className="auth">
      <div className="tabs" role="tablist">
        <Link
          to={`/register${search}`}
          role="tab"
          aria-selected={active === "register"}
          className={active === "register" ? "on" : ""}
        >
          Регистрация
        </Link>
        <Link
          to={`/login${search}`}
          role="tab"
          aria-selected={active === "login"}
          className={active === "login" ? "on" : ""}
        >
          Вход
        </Link>
      </div>
      {children}
    </div>
  );
}
