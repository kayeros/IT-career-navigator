import { Link } from "react-router-dom";

export function LogoMark() {
  return (
    <span className="logo-mark lm-plain" aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 7l5 5-5 5" stroke="var(--accent)" strokeWidth="2.6" />
        <path d="M13 17h5" stroke="var(--ink)" strokeWidth="2.6" />
      </svg>
    </span>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" className="logo" onClick={onClick}>
      <LogoMark />
      <span className="logo-t">
        Карьерный навигатор&nbsp;<b>IT</b>
      </span>
    </Link>
  );
}
