import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendFeedback } from "../../mocks/slice1";
import { validateEmail } from "../auth/validation";

/** Форма «Остались вопросы?» с главной. API для неё пока нет — отправка через заглушку. */
export function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Напишите, как к вам обращаться",
      email: validateEmail(email),
      message: message.trim().length >= 5 ? undefined : "Напишите вопрос",
      consent: consent ? undefined : "Отметьте согласие на обработку персональных данных",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSending(true);
    await sendFeedback({ name: name.trim(), email: email.trim(), message: message.trim() });
    setSending(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="stack o-form sent-box" role="status">
        <span className="chip good">Отправлено</span>
        <h2>Спасибо, мы ответим</h2>
        <p className="muted">Ответ придёт на указанную почту.</p>
      </div>
    );
  }

  return (
    <form className="stack o-form" onSubmit={onSubmit} noValidate>
      <div className="o-form-row">
        <div className="field">
          <label htmlFor="fbName">Имя</label>
          <input
            id="fbName"
            type="text"
            placeholder="Как к вам обращаться"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "fbName-err" : undefined}
          />
          {errors.name && (
            <span id="fbName-err" className="err">
              {errors.name}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="fbMail">Почта</label>
          <input
            id="fbMail"
            type="email"
            placeholder="you@example.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "fbMail-err" : undefined}
          />
          {errors.email && (
            <span id="fbMail-err" className="err">
              {errors.email}
            </span>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="fbMsg">Сообщение</label>
        <textarea
          id="fbMsg"
          placeholder="Ваш вопрос"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "fbMsg-err" : undefined}
        />
        {errors.message && (
          <span id="fbMsg-err" className="err">
            {errors.message}
          </span>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Даю согласие на обработку персональных данных и принимаю{" "}
          <Link to="/privacy">политику конфиденциальности</Link>
        </span>
      </label>
      {errors.consent && <span className="err">{errors.consent}</span>}
      <div>
        <button
          className="btn primary"
          type="submit"
          disabled={sending}
          aria-busy={sending || undefined}
        >
          Отправить
        </button>
      </div>
    </form>
  );
}
