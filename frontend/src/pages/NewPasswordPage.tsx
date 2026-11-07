import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, isApiError, unwrap } from "../api/client";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useToast } from "../components/toastContext";
import { useAuth } from "../features/auth/useAuth";
import { validatePassword } from "../features/auth/validation";
import { errorText } from "../lib/errors";

/** Новый пароль по ссылке из письма: /reset-password?token=… */
export default function NewPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const { setUser } = useAuth();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [fail, setFail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!token)
    return (
      <div className="auth">
        <div className="panel stack">
          <h2>Ссылка неполная</h2>
          <p className="muted">Откройте ссылку из письма целиком или запросите новую.</p>
          <Link className="btn primary" to="/reset">
            Запросить ссылку
          </Link>
        </div>
      </div>
    );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      password: validatePassword(password),
      repeat: repeat !== password ? "Пароли не совпадают" : undefined,
    };
    setErrors(next);
    if (next.password || next.repeat) return;
    setSending(true);
    setFail(null);
    try {
      await unwrap(api.POST("/auth/password-reset/confirm", { body: { token, password } }));
      // Сервер закрыл все сессии — входим заново
      setUser(null);
      toast("Пароль изменён. Войдите с новым паролем");
      navigate("/login", { replace: true });
    } catch (err) {
      if (isApiError(err) && err.fields.password) setErrors({ password: err.fields.password });
      else setFail(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth">
      <form className="panel stack" onSubmit={onSubmit} noValidate>
        <h2>Новый пароль</h2>
        <p className="muted">
          Придумайте новый пароль. После смены нужно будет войти заново на всех устройствах.
        </p>
        <Field
          label="Новый пароль"
          type="password"
          autoComplete="new-password"
          hint="От 8 до 128 символов"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Field
          label="Повторите пароль"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={errors.repeat}
        />
        {fail && (
          <Banner tone="error">
            {fail}{" "}
            <Link to="/reset" className="link-accent">
              Запросить новую ссылку
            </Link>
          </Banner>
        )}
        <Button type="submit" loading={sending}>
          Сохранить пароль
        </Button>
      </form>
    </div>
  );
}
