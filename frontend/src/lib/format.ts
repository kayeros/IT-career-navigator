const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const MONTHS_NOM = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

function parseIso(iso: string): Date | null {
  // "2026-11-01" — дата без времени, берём её как есть, без сдвига часового пояса
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «5 ноября 2026» */
export function formatDate(iso: string): string {
  const d = parseIso(iso);
  return d ? `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}` : iso;
}

/** «ноябрь 2026» */
export function formatMonth(iso: string): string {
  const d = parseIso(iso);
  return d ? `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}` : iso;
}

/** 18.2 → «18,2 %» */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} %`;
}

/** 0.6667 → «67%» */
export function formatShare(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

/** plural(5, ["тема", "темы", "тем"]) → «тем» */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Часы без лишних нулей: 1.5 → «1,5 ч» */
export function formatHours(hours: number): string {
  return `${hours.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ч`;
}

/** Внешние ссылки открываем только по http(s) */
export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** ?next= принимаем только как путь внутри сайта */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/professions";
  return next;
}
