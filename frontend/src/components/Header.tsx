import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { useLogout } from "../features/auth/useAuthActions";
import { useTheme } from "../hooks/useTheme";
import { Logo } from "./Logo";
import { useToast } from "./toastContext";

const ICO_SUN = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const ICO_MOON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);
const ICO_USER = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "on" : "");

/** Шапка из прототипа: логотип, переключатель темы, навигация, бургер на телефоне. */
export function Header() {
  const { user } = useAuth();
  const logout = useLogout();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  const onAuthPage = ["/login", "/register", "/reset"].includes(location.pathname);
  const next = encodeURIComponent(location.pathname + location.search);
  const loginTo = onAuthPage ? "/login" : `/login?next=${next}`;

  return (
    <header className="top">
      <div className={`wrap${menuOpen ? " menu-open" : ""}`} id="topbar">
        <Logo onClick={close} />
        {user ? (
          <button
            className="acct on"
            type="button"
            aria-label="Личный кабинет"
            onClick={() => {
              close();
              navigate("/dashboard");
            }}
          >
            {(user.name || "?").trim().charAt(0).toUpperCase()}
          </button>
        ) : (
          <button
            className="acct"
            type="button"
            aria-label="Войти"
            onClick={() => navigate(loginTo)}
          >
            {ICO_USER}
          </button>
        )}
        <button
          className="burger"
          type="button"
          aria-label="Меню"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className="nav" aria-label="Основная навигация" onClick={close}>
          <button
            className="theme"
            type="button"
            onClick={toggle}
            aria-label={dark ? "Светлая тема" : "Тёмная тема"}
            title={dark ? "Светлая тема" : "Тёмная тема"}
          >
            {dark ? ICO_SUN : ICO_MOON}
          </button>
          <NavLink to="/professions" end className={navClass}>
            Каталог профессий
          </NavLink>
          {user === undefined ? null : user ? (
            <>
              <NavLink to="/plan" className={navClass}>
                Мой план
              </NavLink>
              <NavLink to="/dashboard" className={navClass}>
                Личный кабинет
              </NavLink>
              {user.role === "admin" && (
                <NavLink to="/admin" className={navClass}>
                  Админка
                </NavLink>
              )}
              <button
                type="button"
                className="cta"
                disabled={logout.isPending}
                onClick={() =>
                  logout.mutate(undefined, {
                    onSettled: () => {
                      toast("Вы вышли из аккаунта");
                      navigate("/");
                    },
                  })
                }
              >
                Выйти
              </button>
            </>
          ) : (
            <NavLink
              to={loginTo}
              className={({ isActive }) => (isActive || onAuthPage ? "on" : "cta")}
            >
              Войти
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
