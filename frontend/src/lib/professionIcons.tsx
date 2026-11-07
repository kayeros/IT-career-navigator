import type { CSSProperties, ReactNode } from "react";

// Иконки и цвета профессий из прототипа. Подбираем по slug, у неизвестных — общая иконка.
type Look = { icon: ReactNode; c1: string; c2: string };

const svg = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const LOOKS: Record<string, Look> = {
  frontend: {
    icon: svg(<path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14" />),
    c1: "#5B86FF",
    c2: "#2A4FD4",
  },
  backend: {
    icon: svg(
      <>
        <rect x="3" y="4" width="18" height="7" rx="2" />
        <rect x="3" y="13" width="18" height="7" rx="2" />
        <path d="M7 7.5h.01M7 16.5h.01" />
      </>,
    ),
    c1: "#9A7BFF",
    c2: "#5B3FD0",
  },
  qa: {
    icon: svg(
      <>
        <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>,
    ),
    c1: "#3DD39A",
    c2: "#119068",
  },
  python: {
    icon: svg(
      <>
        <path d="M12 3c-4 0-4 2-4 3v2h4v1H6c-2 0-3 1.5-3 4s1 4 3 4h2v-3c0-1.5 1-2.5 2.5-2.5h3c1.5 0 2.5-1 2.5-2.5V6c0-1.5-1.5-3-4-3z" />
        <path d="M12 21c4 0 4-2 4-3v-2h-4v-1h6c2 0 3-1.5 3-4" />
      </>,
    ),
    c1: "#4FA3FF",
    c2: "#2766C9",
  },
  java: {
    icon: svg(
      <>
        <path d="M6 15h10v1a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4z" />
        <path d="M16 16h1.5a2 2 0 0 0 0-4H16M9 4c1 1.5-1 2.5 0 4M12 3c1 1.5-1 2.5 0 4" />
      </>,
    ),
    c1: "#F6B04D",
    c2: "#C97B12",
  },
  analyst: {
    icon: svg(<path d="M7 7h11l-3-3M17 17H6l3 3" />),
    c1: "#7C8CFF",
    c2: "#4553C9",
  },
  design: {
    icon: svg(
      <>
        <path d="m12 19 7-7 3 3-7 7zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" />
        <path d="m2 2 7.6 7.6" />
        <circle cx="11" cy="11" r="2" />
      </>,
    ),
    c1: "#FFC15A",
    c2: "#E0891C",
  },
  data: {
    icon: svg(<path d="M3 3v18h18M7 15v2M11 10v7M15 12v5M19 6v11" />),
    c1: "#38CFE3",
    c2: "#1590AA",
  },
  devops: {
    icon: svg(<path d="M7 8a4 4 0 1 0 0 8c3 0 7-8 10-8a4 4 0 1 1 0 8c-3 0-7-8-10-8z" />),
    c1: "#2FD1C5",
    c2: "#14988F",
  },
  mobile: {
    icon: svg(
      <>
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <path d="M11 18h2" />
      </>,
    ),
    c1: "#8C98B4",
    c2: "#55607C",
  },
  ds: {
    icon: svg(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />
      </>,
    ),
    c1: "#B98BFF",
    c2: "#7E4BDB",
  },
  aqa: { icon: svg(<path d="m6 4 14 8-14 8z" />), c1: "#56D17A", c2: "#2A9A4B" },
  pm: {
    icon: svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>,
    ),
    c1: "#F6B04D",
    c2: "#C97B12",
  },
  default: {
    icon: svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>,
    ),
    c1: "#8C98B4",
    c2: "#55607C",
  },
};

const RULES: [RegExp, string][] = [
  [/auto|aqa/, "aqa"],
  [/^qa|test/, "qa"],
  [/python/, "python"],
  [/java(?!script)/, "java"],
  [/front/, "frontend"],
  [/back|go-|node/, "backend"],
  [/mobile|ios|android/, "mobile"],
  [/scien|^ds|ml/, "ds"],
  [/data/, "data"],
  [/analyst|^sa-|system/, "analyst"],
  [/design|ux|ui/, "design"],
  [/devops/, "devops"],
  [/product|^pm/, "pm"],
];

export function professionLook(slug: string): Look {
  const key = RULES.find(([re]) => re.test(slug))?.[1] ?? "default";
  return LOOKS[key];
}

/** CSS-переменные цвета для .pk-i */
export function lookStyle(slug: string): CSSProperties {
  const look = professionLook(slug);
  return { "--c1": look.c1, "--c2": look.c2 } as CSSProperties;
}
