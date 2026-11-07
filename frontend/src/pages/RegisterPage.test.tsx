import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch, renderAt } from "../test/render";
import RegisterPage from "./RegisterPage";

const routes = [{ path: "/register", element: <RegisterPage /> }];
const guest = { status: 401, body: { error: { code: "unauthorized", message: "" } } };

async function fill() {
  await userEvent.type(await screen.findByLabelText("Имя"), "Иван");
  await userEvent.type(screen.getByLabelText("Почта"), "ivan@example.ru");
  await userEvent.type(screen.getByLabelText("Пароль"), "секрет123");
}

describe("RegisterPage", () => {
  it("без согласия на ПД запрос не уходит", async () => {
    const fetch = mockFetch(() => guest);
    renderAt("/register", routes);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    expect(screen.getByText("Без согласия мы не можем создать аккаунт")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("занятая почта — ошибка у поля и ссылка «Войти»", async () => {
    mockFetch((method) =>
      method === "POST"
        ? {
            status: 409,
            body: { error: { code: "email_taken", message: "Почта уже зарегистрирована" } },
          }
        : guest,
    );
    renderAt("/register", routes);
    await fill();
    await userEvent.click(screen.getByRole("checkbox", { name: /персональных данных/ }));
    await userEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    expect(await screen.findByText("Почта уже зарегистрирована")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Войти" })).toBeInTheDocument();
  });

  it("ошибки сервера из fields — под полями", async () => {
    mockFetch((method) =>
      method === "POST"
        ? {
            status: 400,
            body: {
              error: {
                code: "validation_error",
                message: "Проверьте поля формы",
                fields: { password: "Слишком простой пароль" },
              },
            },
          }
        : guest,
    );
    renderAt("/register", routes);
    await fill();
    await userEvent.click(screen.getByRole("checkbox", { name: /персональных данных/ }));
    await userEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    expect(await screen.findByText("Слишком простой пароль")).toBeInTheDocument();
  });
});
