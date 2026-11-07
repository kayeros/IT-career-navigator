import { Suspense } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton";
import { RequireAuth } from "../../features/auth/RequireAuth";
import { useAuth } from "../../features/auth/useAuth";

const SECTIONS = [
  ["/admin/professions", "Профессии"],
  ["/admin/topics", "Темы"],
  ["/admin/skills", "Навыки и синонимы"],
  ["/admin/resources", "Материалы"],
  ["/admin/terms", "Неизвестные термины"],
  ["/admin/waitlist", "Заявки на запуск"],
] as const;

/** Админка контента: только для роли admin. */
export default function AdminLayout() {
  return (
    <RequireAuth>
      <AdminOnly />
    </RequireAuth>
  );
}

function AdminOnly() {
  const { user } = useAuth();
  if (user?.role !== "admin")
    return (
      <div className="panel stack narrow-panel">
        <h1>Нет доступа</h1>
        <p className="muted">Админка доступна только команде проекта.</p>
        <Link className="btn primary self-start" to="/">
          На главную
        </Link>
      </div>
    );
  return (
    <div className="adm">
      <nav className="adm-nav" aria-label="Разделы админки">
        <span className="eyebrow">Админка</span>
        {SECTIONS.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "on" : "")}>
            {label}
          </NavLink>
        ))}
      </nav>
      <section className="adm-main min-0">
        <Suspense fallback={<Skeleton height={300} />}>
          <Outlet />
        </Suspense>
      </section>
    </div>
  );
}
