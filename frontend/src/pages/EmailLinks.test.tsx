import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { USER } from "../test/fixtures";
import { mockFetch, renderAt } from "../test/render";
import NewPasswordPage from "./NewPasswordPage";
import VerifyEmailPage from "./VerifyEmailPage";

const routes = [
  { path: "/reset-password", element: <NewPasswordPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/login", element: <p>вход</p> },
];

describe("Ссылки из писем", () => {
  it("новый пароль: проверка повтора, затем смена и переход ко входу", async () => {
    const bodies: unknown[] = [];
    mockFetch((_m, path, body) => {
      if (path.endsWith("/me"))
        return { status: 401, body: { error: { code: "unauthorized", message: "" } } };
      if (path.endsWith("/password-reset/confirm")) {
        bodies.push(body);
        return { status: 204 };
      }
      return { status: 404 };
    });
    renderAt("/reset-password?token=abc", routes);
    await userEvent.type(await screen.findByLabelText("Новый пароль"), "secret-pass-1");
    await userEvent.type(screen.getByLabelText("Повторите пароль"), "другой-пароль");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить пароль" }));
    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
    await userEvent.clear(screen.getByLabelText("Повторите пароль"));
    await userEvent.type(screen.getByLabelText("Повторите пароль"), "secret-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить пароль" }));
    expect(await screen.findByText("вход")).toBeInTheDocument();
    expect(bodies).toEqual([{ token: "abc", password: "secret-pass-1" }]);
  });

  it("новый пароль: просроченная ссылка — предлагаем запросить новую", async () => {
    mockFetch((_m, path) => {
      if (path.endsWith("/me"))
        return { status: 401, body: { error: { code: "unauthorized", message: "" } } };
      return { status: 400, body: { error: { code: "invalid_token", message: "" } } };
    });
    renderAt("/reset-password?token=old", routes);
    await userEvent.type(await screen.findByLabelText("Новый пароль"), "secret-pass-1");
    await userEvent.type(screen.getByLabelText("Повторите пароль"), "secret-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить пароль" }));
    expect(await screen.findByRole("link", { name: "Запросить новую ссылку" })).toBeInTheDocument();
  });

  it("подтверждение почты по ссылке", async () => {
    mockFetch((_m, path) => {
      if (path.endsWith("/me")) return { status: 200, body: { ...USER, email_verified: false } };
      if (path.endsWith("/verify-email")) return { status: 204 };
      return { status: 404 };
    });
    renderAt("/verify-email?token=t1", routes);
    expect(await screen.findByText("Почта подтверждена")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "К профессиям" })).toBeInTheDocument();
  });

  it("подтверждение почты: ссылка без токена", async () => {
    mockFetch(() => ({ status: 401, body: { error: { code: "unauthorized", message: "" } } }));
    renderAt("/verify-email", routes);
    expect(await screen.findByText("Ссылка неполная")).toBeInTheDocument();
  });
});
