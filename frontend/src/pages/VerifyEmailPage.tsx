import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, unwrap } from "../api/client";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../features/auth/useAuth";
import { errorText } from "../lib/errors";

/** Подтверждение почты по ссылке из письма: /verify-email?token=… */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, setUser } = useAuth();
  // useQuery вместо эффекта: запрос уйдёт один раз, даже при двойном монтировании в StrictMode
  const verify = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      await unwrap(api.POST("/auth/verify-email", { body: { token } }));
      return true;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const ok = verify.isSuccess;
  useEffect(() => {
    if (ok && user && !user.email_verified) setUser({ ...user, email_verified: true });
  }, [ok, user, setUser]);

  return (
    <div className="auth">
      <div className="panel stack">
        {!token ? (
          <>
            <h2>Ссылка неполная</h2>
            <p className="muted">Откройте ссылку из письма целиком.</p>
          </>
        ) : verify.isPending ? (
          <>
            <h2>Подтверждаем почту…</h2>
            <Skeleton height={14} width="60%" />
          </>
        ) : verify.isError ? (
          <>
            <h2>Не получилось подтвердить</h2>
            <p className="muted">{errorText(verify.error)}</p>
            {user && (
              <p className="muted fs-14">Новое письмо можно отправить из плашки вверху страницы.</p>
            )}
          </>
        ) : (
          <>
            <span className="chip good self-start">Почта подтверждена</span>
            <h2>Готово!</h2>
            <p className="muted">Спасибо. Теперь вам доступны все возможности аккаунта.</p>
          </>
        )}
        <Link className="btn primary" to={user ? "/professions" : "/login"}>
          {user ? "К профессиям" : "Войти"}
        </Link>
      </div>
    </div>
  );
}
