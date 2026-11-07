import { NavLink } from "react-router-dom";

/** Боковое меню раздела «Информация»: документы и «О проекте». */
const DOCS: [string, string][] = [
  ["/privacy", "Политика конфиденциальности"],
  ["/terms", "Пользовательское соглашение"],
  ["/about", "О проекте"],
];

export function DocNav() {
  return (
    <nav className="doc-nav" aria-label="Информация">
      <span className="eyebrow">Информация</span>
      {DOCS.map(([to, title]) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "on" : undefined)}>
          {title}
        </NavLink>
      ))}
    </nav>
  );
}
