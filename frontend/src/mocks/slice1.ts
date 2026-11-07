/**
 * Заглушки для того, чего ещё нет в api/openapi.yaml.
 * Сейчас осталась только форма обратной связи на главной (в API — «позже»).
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Сообщение из формы обратной связи на главной. */
export async function sendFeedback(body: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  void body;
  await wait(400);
}
