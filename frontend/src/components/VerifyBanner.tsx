import { useState } from "react";
import { api, isApiError, unwrap } from "../api/client";
import { useAuth } from "../features/auth/useAuth";
import { errorText } from "../lib/errors";
import { useToast } from "./toastContext";

/** Плашка «Подтвердите почту» для вошедшего с неподтверждённой почтой. */
export function VerifyBanner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => readHidden());
  if (!user || user.email_verified || hidden) return null;

  const hide = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* без хранилища просто скрываем до перезагрузки */
    }
  };

  const resend = async () => {
    setSending(true);
    setNote(null);
    try {
      await unwrap(api.POST("/auth/verify-email/resend"));
      toast("Письмо отправлено");
      setNote("Письмо отправлено. Проверьте и «Спам».");
    } catch (e) {
      if (isApiError(e) && e.code === "already_verified")
        setUser({ ...user, email_verified: true });
      else setNote(errorText(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="wrap verify-wrap">
      <div className="verify-card" role="status">
        <span className="verify-ico" aria-hidden="true">
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
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </span>
        <div className="verify-text">
          <b>Подтвердите почту</b>
          <span className="muted">
            {note ?? (
              <>
                Мы отправили ссылку на <span className="verify-mail">{user.email}</span>
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          className="btn link sm"
          onClick={resend}
          disabled={sending}
          aria-busy={sending || undefined}
        >
          Отправить ещё раз
        </button>
        <button type="button" className="icon-btn verify-close" aria-label="Скрыть" onClick={hide}>
          ×
        </button>
      </div>
    </div>
  );
}

const HIDE_KEY = "verifyBannerHidden";

/** Плашку можно скрыть до конца сессии браузера. */
function readHidden(): boolean {
  try {
    return sessionStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}
