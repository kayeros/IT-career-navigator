import { useToast } from "../components/toastContext";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { isApiError } from "../api/client";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { AuthTabs } from "../features/auth/AuthTabs";
import { useAuth } from "../features/auth/useAuth";
import { useRegister } from "../features/auth/useAuthActions";
import {
  compact,
  validateEmail,
  validateName,
  validatePassword,
  type FieldErrors,
} from "../features/auth/validation";
import { errorText } from "../lib/errors";
import { safeNext } from "../lib/format";

export default function RegisterPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const toast = useToast();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentPd, setConsentPd] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [emailTaken, setEmailTaken] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (user && !register.isPending && !register.isSuccess) return <Navigate to={next} replace />;

  const loginLink = `/login?next=${encodeURIComponent(next)}`;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setEmailTaken(false);
    const errors = compact({
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      consent_pd: consentPd ? undefined : "Без согласия мы не можем создать аккаунт",
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    register.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        password,
        consent_pd: consentPd,
        consent_marketing: consentMarketing,
      },
      {
        // После регистрации пользователь уже вошёл
        onSuccess: () => {
          toast("Аккаунт создан");
          // После регистрации — онбординг; профессию, с которой пришли, подставим в шаг 2
          const m = /^\/professions\/([\w-]+)/.exec(next);
          navigate(m ? `/onboarding?profession=${m[1]}` : "/onboarding", { replace: true });
        },
        onError: (err) => {
          if (
            isApiError(err) &&
            err.code === "validation_error" &&
            Object.keys(err.fields).length
          ) {
            setFieldErrors(err.fields);
          } else if (isApiError(err) && err.code === "email_taken") {
            setEmailTaken(true);
            setFieldErrors({ email: err.message || "Эта почта уже зарегистрирована" });
          } else {
            setFormError(errorText(err));
          }
        },
      },
    );
  };

  return (
    <AuthTabs active="register">
      <form className="panel stack" onSubmit={onSubmit} noValidate>
        <h2>Создать аккаунт</h2>
        {formError && <Banner tone="error">{formError}</Banner>}
        <Field
          label="Имя"
          name="name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />
        <Field
          label="Почта"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={
            fieldErrors.email && (
              <>
                {fieldErrors.email}
                {emailTaken && (
                  <>
                    {" "}
                    <Link to={loginLink}>Войти</Link>
                  </>
                )}
              </>
            )
          }
        />
        <Field
          label="Пароль"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint="От 8 до 128 символов"
        />
        <label className="check">
          <input
            id="consent_pd"
            type="checkbox"
            checked={consentPd}
            onChange={(e) => setConsentPd(e.target.checked)}
            aria-invalid={fieldErrors.consent_pd ? true : undefined}
            aria-describedby={fieldErrors.consent_pd ? "consent_pd-error" : undefined}
          />
          <span>
            Даю согласие на обработку персональных данных и принимаю{" "}
            <Link to="/privacy" target="_blank">
              политику конфиденциальности
            </Link>
          </span>
        </label>
        {fieldErrors.consent_pd && (
          <span id="consent_pd-error" className="err">
            {fieldErrors.consent_pd}
          </span>
        )}
        <label className="check">
          <input
            id="consent_marketing"
            type="checkbox"
            checked={consentMarketing}
            onChange={(e) => setConsentMarketing(e.target.checked)}
          />
          <span>Хочу получать новости о запуске и новых профессиях</span>
        </label>
        <Button type="submit" loading={register.isPending}>
          Зарегистрироваться
        </Button>
      </form>
    </AuthTabs>
  );
}
