import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { validateEmail } from "../features/auth/validation";
import { api, unwrap } from "../api/client";
import { Banner } from "../components/Banner";
import { errorText } from "../lib/errors";

/** Восстановление пароля: письмо со ссылкой /reset-password?token=… */
export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setSending(true);
    setFail(null);
    try {
      // Ответ всегда 204: сервер не выдаёт, есть ли такая почта
      await unwrap(api.POST("/auth/password-reset", { body: { email: email.trim() } }));
      setDone(true);
    } catch (err) {
      setFail(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth">
      <form className="panel stack" onSubmit={onSubmit} noValidate>
        <h2>Восстановление пароля</h2>
        <p className="muted">
          Укажите почту, на которую регистрировались. Пришлём ссылку для смены пароля.
        </p>
        <Field
          label="Почта"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        {fail && <Banner tone="error">{fail}</Banner>}
        {done && (
          <span className="chip good self-start" role="status">
            Если такая почта зарегистрирована, ссылка уже в пути. Проверьте и «Спам»
          </span>
        )}
        <div className="row between">
          <Button type="submit" loading={sending}>
            Отправить ссылку
          </Button>
          <Link to="/login" className="btn link">
            ← Назад ко входу
          </Link>
        </div>
      </form>
    </div>
  );
}
