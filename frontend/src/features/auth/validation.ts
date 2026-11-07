// Проверки на фронте повторяют правила API, но истина — ответ сервера
export type FieldErrors = Partial<Record<string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const v = email.trim();
  if (!v) return "Введите почту";
  if (v.length > 254 || !EMAIL_RE.test(v)) return "Проверьте адрес почты";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Введите пароль";
  if (password.length < 8 || password.length > 128)
    return "Пароль должен быть от 8 до 128 символов";
  return undefined;
}

export function validateName(name: string): string | undefined {
  const v = name.trim();
  if (!v) return "Введите имя";
  if (v.length > 100) return "Имя должно быть не длиннее 100 символов";
  return undefined;
}

export function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}
