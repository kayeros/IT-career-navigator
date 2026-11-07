import { Link } from "react-router-dom";

export default function NotFoundPage({ title = "Страница не найдена" }: { title?: string }) {
  return (
    <div className="stack nf-wrap">
      <span className="mono nf-code">404</span>
      <h1>{title}</h1>
      <p className="muted">Возможно, ссылка устарела или в адресе опечатка.</p>
      <div className="row">
        <Link className="btn primary" to="/">
          На главную
        </Link>
        <Link className="btn ghost" to="/professions">
          Каталог профессий
        </Link>
      </div>
    </div>
  );
}
