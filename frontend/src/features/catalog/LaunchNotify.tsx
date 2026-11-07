import { useState, type FormEvent } from "react";
import { useToast } from "../../components/toastContext";
import { api, unwrap } from "../../api/client";
import { errorText } from "../../lib/errors";
import { useAuth } from "../auth/useAuth";
import { validateEmail } from "../auth/validation";

/** «Сообщить о запуске» на карточке профессии «скоро». Вошедшему — в один клик, гостю — поле почты. */
export function LaunchNotify({ slug, title }: { slug: string; title: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<"idle" | "form" | "sending" | "done">("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = async (to: string | null) => {
    setState("sending");
    try {
      // Вошедшему почту не передаём — сервер возьмёт из аккаунта
      await unwrap(
        api.POST("/waitlist", {
          body: to ? { profession_slug: slug, email: to } : { profession_slug: slug },
        }),
      );
      setState("done");
      toast(`Сообщим о запуске «${title}»`);
    } catch (e) {
      setState(user ? "idle" : "form");
      setError(errorText(e));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err ?? null);
    if (!err) void send(email.trim());
  };

  if (state === "done") return <span className="chip good pc-wait">Сообщим о запуске ✓</span>;

  if (state === "form" || (state === "sending" && !user)) {
    const id = `notify-${slug}`;
    return (
      <form className="pc-notify" onSubmit={onSubmit} noValidate>
        <label htmlFor={id} className="sr-only">
          Почта для уведомления о запуске «{title}»
        </label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          placeholder="Ваша почта"
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn primary sm" disabled={state === "sending"}>
          Сообщить
        </button>
        {error && (
          <span id={`${id}-err`} className="err">
            {error}
          </span>
        )}
      </form>
    );
  }

  return (
    <button
      type="button"
      className="btn link pc-go"
      disabled={state === "sending"}
      onClick={() => (user ? void send(null) : setState("form"))}
    >
      Сообщить о запуске →
    </button>
  );
}
