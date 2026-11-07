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
  if (!user || user.email_verified) return null;

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
    <div className="verify-banner" role="status">
      <div className="wrap verify-in">
        <span>
          Подтвердите почту <b>{user.email}</b> — мы отправили письмо со ссылкой.
          {note && <span className="muted"> {note}</span>}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          onClick={resend}
          disabled={sending}
          aria-busy={sending || undefined}
        >
          Отправить ещё раз
        </button>
      </div>
    </div>
  );
}
