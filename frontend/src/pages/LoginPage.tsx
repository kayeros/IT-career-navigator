import { useToast } from "../components/toastContext";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { isApiError } from "../api/client";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { AuthTabs } from "../features/auth/AuthTabs";
import { useAuth } from "../features/auth/useAuth";
import { useLogin } from "../features/auth/useAuthActions";
import { compact, validateEmail, type FieldErrors } from "../features/auth/validation";
import { errorText } from "../lib/errors";
import { plural, safeNext } from "../lib/format";

export default function LoginPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const rawNext = params.get("next");
  const next = safeNext(rawNext);
  const navigate = useNavigate();
  const toast = useToast();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);

  // Обратный отсчёт после 429 too_many_attempts
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = window.setTimeout(() => setLockSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [lockSeconds]);

  if (user && !login.isPending && !login.isSuccess) return <Navigate to={next} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errors = compact({
      email: validateEmail(email),
      password: password ? undefined : "Введите пароль",
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          toast("Вы вошли");
          navigate(next, { replace: true });
        },
        onError: (err) => {
          if (
            isApiError(err) &&
            err.code === "validation_error" &&
            Object.keys(err.fields).length
          ) {
            setFieldErrors(err.fields);
            return;
          }
          if (isApiError(err) && err.code === "too_many_attempts")
            setLockSeconds(err.retryAfter ?? 900);
          setFormError(errorText(err));
        },
      },
    );
  };

  const minutes = Math.ceil(lockSeconds / 60);

  return (
    <AuthTabs active="login">
      {rawNext && next !== "/professions" && (
        <Banner>Войдите, чтобы продолжить. После входа вернём вас на ту же страницу.</Banner>
      )}
      <form className="panel stack" onSubmit={onSubmit} noValidate>
        <h2>Вход</h2>
        {formError && (
          <Banner tone="error">
            {formError}
            {lockSeconds > 0 &&
              ` Снова можно через ${minutes} ${plural(minutes, ["минуту", "минуты", "минут"])}.`}
          </Banner>
        )}
        <Field
          label="Почта"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <Field
          label="Пароль"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <div className="row between">
          <Button type="submit" loading={login.isPending} disabled={lockSeconds > 0}>
            Войти
          </Button>
          <Link to="/reset" className="btn link">
            Забыли пароль?
          </Link>
        </div>
      </form>
    </AuthTabs>
  );
}
