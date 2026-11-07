import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PROFESSIONS } from "../test/fixtures";
import { mockFetch, renderAt } from "../test/render";
import CatalogPage from "./CatalogPage";

const routes = [{ path: "/professions", element: <CatalogPage /> }];
const guest = (_method: string, path: string) =>
  path.endsWith("/professions")
    ? { status: 200, body: { items: PROFESSIONS } }
    : path.endsWith("/waitlist")
      ? { status: 204 }
      : { status: 401, body: { error: { code: "unauthorized", message: "" } } };

describe("CatalogPage", () => {
  it("доступные профессии — ссылки, «скоро» — нет", async () => {
    mockFetch(guest);
    renderAt("/professions", routes);
    expect(await screen.findByRole("link", { name: /Ручное тестирование/ })).toHaveAttribute(
      "href",
      "/professions/qa-manual",
    );
    expect(screen.getByText("Frontend-разработчик").closest("a")).toBeNull();
  });

  it("фильтр и поиск", async () => {
    mockFetch(guest);
    renderAt("/professions", routes);
    await screen.findByText("Java-разработчик");
    await userEvent.click(screen.getByRole("button", { name: /^Скоро/ }));
    expect(screen.queryByText("Java-разработчик")).toBeNull();
    expect(screen.getByText("Frontend-разработчик")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Все/ }));
    await userEvent.type(screen.getByLabelText("Поиск по названию"), "java");
    expect(screen.getByText("Java-разработчик")).toBeInTheDocument();
    expect(screen.queryByText("Ручное тестирование (QA)")).toBeNull();
    await userEvent.type(screen.getByLabelText("Поиск по названию"), "zzz");
    expect(screen.getByText(/ничего не нашлось/)).toBeInTheDocument();
  });

  it("во вкладках — число профессий", async () => {
    mockFetch(guest);
    renderAt("/professions", routes);
    expect(await screen.findByRole("button", { name: "Доступные2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скоро1" })).toBeInTheDocument();
  });

  it("гость подписывается на запуск профессии «скоро» по почте", async () => {
    mockFetch(guest);
    renderAt("/professions", routes);
    await userEvent.click(await screen.findByRole("button", { name: /Сообщить о запуске/ }));
    const input = screen.getByLabelText(/Почта для уведомления/);
    await userEvent.click(screen.getByRole("button", { name: "Сообщить" }));
    expect(input).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(input, "ivan@example.ru");
    await userEvent.click(screen.getByRole("button", { name: "Сообщить" }));
    expect(await screen.findByText(/Сообщим о запуске ✓/)).toBeInTheDocument();
  });

  it("ошибка загрузки — кнопка «Повторить»", async () => {
    mockFetch(() => ({ status: 500, body: { error: { code: "internal", message: "" } } }));
    renderAt("/professions", routes);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});
