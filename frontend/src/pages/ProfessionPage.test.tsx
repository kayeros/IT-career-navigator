import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_MATCH, qaDetail, USER } from "../test/fixtures";
import { mockFetch, renderAt } from "../test/render";
import ProfessionPage from "./ProfessionPage";

const routes = [{ path: "/professions/:slug", element: <ProfessionPage /> }];

/** Мок API с состоянием «Изучено». */
function api(loggedIn: boolean, failToggle = false) {
  const studied = new Set(loggedIn ? [10] : []);
  return mockFetch((method, path) => {
    if (path.endsWith("/me"))
      return loggedIn
        ? { status: 200, body: USER }
        : { status: 401, body: { error: { code: "unauthorized", message: "" } } };
    if (path.endsWith("/professions/nope"))
      return { status: 404, body: { error: { code: "not_found", message: "" } } };
    if (path.endsWith("/match")) return { status: 200, body: EMPTY_MATCH };
    const m = /\/topics\/(\d+)\/progress$/.exec(path);
    if (m) {
      if (failToggle) return { status: 500, body: { error: { code: "internal", message: "" } } };
      if (method === "PUT") studied.add(Number(m[1]));
      else studied.delete(Number(m[1]));
      return { status: 204 };
    }
    const d = qaDetail(loggedIn);
    d.blocks = d.blocks.map((b) => ({
      ...b,
      topics: b.topics.map((t) => ({ ...t, studied: studied.has(t.id) })),
    }));
    if (d.progress) d.progress = { ...d.progress, studied: studied.size };
    return { status: 200, body: d };
  });
}

const drawer = () => screen.getByRole("dialog", { hidden: true });

describe("ProfessionPage", () => {
  it("гость: тема открывается в панели, в адресе — slug темы, вместо «Изучено» — вход", async () => {
    api(false);
    const { router } = renderAt("/professions/qa-manual", routes);
    const [node] = await screen.findAllByRole("button", { name: "Теория тестирования" });
    await userEvent.click(node);
    expect(router.state.location.hash).toBe("#qa-theory");
    const d = within(drawer());
    expect(d.getByRole("heading", { name: "Теория тестирования" })).toBeInTheDocument();
    expect(d.getByRole("link", { name: /Войти, чтобы отметить/ })).toHaveAttribute(
      "href",
      "/login?next=%2Fprofessions%2Fqa-manual%23qa-theory",
    );
    // небезопасные ссылки материалов не показываем
    expect(d.getByRole("link", { name: /Материал Теория/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(d.queryByText("Опасная ссылка")).toBeNull();
  });

  it("Escape закрывает панель", async () => {
    api(false);
    const { router } = renderAt("/professions/qa-manual#qa-design", routes);
    await screen.findByRole("heading", { name: "Тест-дизайн" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(router.state.location.hash).toBe(""));
  });

  it("вошедший: «Изучено» отправляет PUT и обновляет прогресс", async () => {
    const fetch = api(true);
    renderAt("/professions/qa-manual#qa-design", routes);
    expect(await screen.findByText("Изучено 1 из 4")).toBeInTheDocument();
    await userEvent.click(within(drawer()).getByRole("button", { name: "Изучено" }));
    expect(await screen.findByText("Изучено 2 из 4")).toBeInTheDocument();
    expect(
      fetch.mock.calls.some(
        ([r]) =>
          r instanceof Request && r.method === "PUT" && r.url.endsWith("/topics/11/progress"),
      ),
    ).toBe(true);
    expect(within(drawer()).getByRole("button", { name: /снять отметку/ })).toBeInTheDocument();
  });

  it("ошибка сохранения — отметка откатывается и показывается сообщение", async () => {
    api(true, true);
    renderAt("/professions/qa-manual#qa-design", routes);
    await screen.findByText("Изучено 1 из 4");
    await userEvent.click(within(drawer()).getByRole("button", { name: "Изучено" }));
    expect(await within(drawer()).findByRole("alert")).toHaveTextContent(
      "Не удалось сохранить отметку",
    );
    expect(screen.getByText("Изучено 1 из 4")).toBeInTheDocument();
  });

  it("блок открывает список тем", async () => {
    api(false);
    renderAt("/professions/qa-manual", routes);
    const [block] = await screen.findAllByRole("button", { name: /Инструменты/ });
    await userEvent.click(block);
    await userEvent.click(within(drawer()).getByRole("button", { name: "Git" }));
    expect(within(drawer()).getByRole("heading", { name: "Git" })).toBeInTheDocument();
  });

  it("несуществующая профессия — 404", async () => {
    api(false);
    renderAt("/professions/nope", routes);
    expect(await screen.findByRole("heading", { name: "Такой профессии нет" })).toBeInTheDocument();
  });
});
