import { isApiError } from "../api/client";

// Общие тексты ошибок, чтобы не дублировать их по компонентам
export const MESSAGES = {
  generic: "Что-то пошло не так, попробуйте позже",
  network: "Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз",
  invalidCredentials: "Неверная почта или пароль",
  tooManyAttempts: "Слишком много попыток входа. Попробуйте позже",
  notFound: "Такой страницы нет",
  loginToMark: "Войдите, чтобы отмечать темы",
  toggleFailed: "Не удалось сохранить отметку. Попробуйте ещё раз",
  invalidToken: "Ссылка устарела или уже использована. Запросите новую",
  tooOften: "Слишком часто. Попробуйте через минуту",
} as const;

/** Текст для общего сообщения об ошибке. Ветвимся только по code. */
export function errorText(e: unknown): string {
  if (!isApiError(e)) return MESSAGES.generic;
  switch (e.code) {
    case "network":
      return MESSAGES.network;
    case "invalid_credentials":
      return MESSAGES.invalidCredentials;
    case "too_many_attempts":
      return MESSAGES.tooManyAttempts;
    case "not_found":
      return MESSAGES.notFound;
    case "invalid_token":
      return MESSAGES.invalidToken;
    case "too_many_requests":
      return MESSAGES.tooOften;
    case "validation_error":
    case "email_taken":
    case "too_soon":
    case "completed":
      return e.message || MESSAGES.generic;
    default:
      return MESSAGES.generic;
  }
}
