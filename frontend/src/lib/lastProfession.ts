// Последняя открытая профессия — для ссылки «Мой план» в шапке. Это настройка интерфейса, не данные.
const KEY = "nav-last-prof";

export function saveLastProfession(slug: string) {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    /* приватный режим — не страшно */
  }
}

export function lastProfession(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
