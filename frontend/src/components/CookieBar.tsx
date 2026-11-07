import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "nav-cookie";

function accepted() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Плашка о cookie из прототипа. Согласие помним в localStorage (UI-настройка). */
export function CookieBar() {
  const [ok, setOk] = useState(accepted);

  useEffect(() => {
    document.body.classList.toggle("has-cookie", !ok);
  }, [ok]);

  if (ok) return null;
  return (
    <div className="cookie" role="region" aria-label="Файлы cookie">
      <div className="cookie-in">
        <p>
          Мы используем файлы cookie. Продолжая пользоваться сайтом, вы соглашаетесь с{" "}
          <Link to="/privacy">политикой конфиденциальности</Link>.
        </p>
        <button
          type="button"
          className="btn primary sm"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              // не сохранили — плашка появится снова после перезагрузки
            }
            setOk(true);
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
