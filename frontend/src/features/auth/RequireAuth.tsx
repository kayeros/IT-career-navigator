import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingLabel, Skeleton } from "../../components/Skeleton";
import { useAuth } from "./useAuth";

/** Экран только для вошедших: гостя отправляем на вход и возвращаем обратно после него. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined)
    return (
      <div className="stack" aria-busy="true">
        <LoadingLabel text="Проверяем вход…" />
        <Skeleton height={40} width="40%" />
        <Skeleton height={200} />
      </div>
    );
  if (user === null) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
