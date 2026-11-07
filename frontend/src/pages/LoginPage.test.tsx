import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch, renderAt } from "../test/render";
import LoginPage from "./LoginPage";

const routes = [{ path: "/login", element: <LoginPage /> }];

describe("LoginPage", () => {
  it("проверяет поля до запроса", async () => {
    const fetch = mockFetch(() => ({
      status: 401,
      body: { error: { code: "unauthorized", message: "" } },
    }));
    renderAt("/login", routes);
    await userEvent.click(await screen.findByRole("button", { name: "Войти" }));
    expect(screen.getByLabelText("Почта")).toHaveAccessibleDescription("Введите почту");
    expect(fetch).toHaveBeenCalledTimes(1); // только GET /me
  });

  it("неверный пароль — общее сообщение над формой", async () => {
    mockFetch((method, path) =>
      method === "POST" && path.endsWith("/auth/login")
        ? { status: 401, body: { error: { code: "invalid_credentials", message: "x" } } }
        : { status: 401, body: { error: { code: "unauthorized", message: "" } } },
    );
    renderAt("/login", routes);
    await userEvent.type(await screen.findByLabelText("Почта"), "ivan@example.ru");
    await userEvent.type(screen.getByLabelText("Пароль"), "секрет123");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Неверная почта или пароль");
  });

  it("429 блокирует кнопку", async () => {
    mockFetch((method) =>
      method === "POST"
        ? {
            status: 429,
            body: { error: { code: "too_many_attempts", message: "" } },
            headers: { "Retry-After": "120" },
          }
        : { status: 401, body: { error: { code: "unauthorized", message: "" } } },
    );
    renderAt("/login", routes);
    await userEvent.type(await screen.findByLabelText("Почта"), "ivan@example.ru");
    await userEvent.type(screen.getByLabelText("Пароль"), "секрет123");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("через 2 минуты");
    expect(screen.getByRole("button", { name: "Войти" })).toBeDisabled();
  });

  it("после входа возвращает на страницу из ?next=", async () => {
    const user = {
      id: 7,
      email: "ivan@example.ru",
      name: "Иван",
      role: "user",
      email_verified: false,
    };
    mockFetch((method) =>
      method === "POST"
        ? { status: 200, body: user }
        : { status: 401, body: { error: { code: "unauthorized", message: "" } } },
    );
    const { router } = renderAt("/login?next=%2Fprofessions%2Fqa-manual", routes);
    await userEvent.type(await screen.findByLabelText("Почта"), "ivan@example.ru");
    await userEvent.type(screen.getByLabelText("Пароль"), "секрет123");
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/professions/qa-manual"));
  });
});
