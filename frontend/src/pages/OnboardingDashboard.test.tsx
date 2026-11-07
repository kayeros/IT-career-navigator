import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makePlan, PROFESSIONS, PROFILE, qaDetail, USER } from "../test/fixtures";
import { mockFetch, renderAt } from "../test/render";
import DashboardPage from "./DashboardPage";
import OnboardingPage from "./OnboardingPage";

const routes = [
  { path: "/onboarding", element: <OnboardingPage /> },
  { path: "/dashboard", element: <DashboardPage /> },
  { path: "/professions/:slug", element: <p>карточка</p> },
  { path: "/quiz", element: <p>профориентация</p> },
];

const notFound = { status: 404, body: { error: { code: "not_found", message: "" } } };

describe("Онбординг", () => {
  it("4 шага: каждый сохраняет свои поля, в конце — карточка профессии", async () => {
    const puts: unknown[] = [];
    mockFetch((method, path, body) => {
      if (path.endsWith("/me")) return { status: 200, body: USER };
      if (path.endsWith("/me/profile")) {
        if (method === "PUT") puts.push(body);
        return { status: 200, body: PROFILE };
      }
      if (path.endsWith("/professions")) return { status: 200, body: { items: PROFESSIONS } };
      return notFound;
    });
    renderAt("/onboarding", routes);
    const next = () => userEvent.click(screen.getByRole("button", { name: /Далее|Готово/ }));

    await userEvent.click(await screen.findByRole("button", { name: "Далее" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Выберите вариант");
    await userEvent.click(screen.getByLabelText("Студент"));
    await userEvent.selectOptions(screen.getByLabelText("Курс"), "3");
    await next();

    await userEvent.click(await screen.findByLabelText("Java-разработчик"));
    expect(screen.queryByLabelText("Frontend-разработчик")).not.toBeInTheDocument();
    await next();

    expect(await screen.findByLabelText(/Сколько часов в неделю/)).toHaveValue("8");
    await next();

    await userEvent.type(await screen.findByLabelText(/Сколько месяцев/), "4");
    await userEvent.click(screen.getByLabelText("Да, было"));
    await next();

    expect(await screen.findByText("карточка")).toBeInTheDocument();
    expect(puts).toEqual([
      { learner_status: "student", course: 3 },
      { hours_per_week: 8, deadline: null },
      { months_learning: 4, learned_unneeded: true, complete_onboarding: true },
    ]);
  });
});

describe("Личный кабинет", () => {
  it("текущий шаг плана и строка профессии с процентом", async () => {
    mockFetch((_m, path) => {
      if (path.endsWith("/me")) return { status: 200, body: USER };
      if (path.endsWith("/me/profile"))
        return { status: 200, body: { ...PROFILE, onboarding_completed: true } };
      if (path.endsWith("/professions")) return { status: 200, body: { items: PROFESSIONS } };
      if (path.endsWith("/qa-manual/plan")) return { status: 200, body: makePlan() };
      if (path.endsWith("/qa-manual/report"))
        return {
          status: 200,
          body: {
            percent: 42,
            snapshot: null,
            assessment: { id: 1, completed_at: "2026-11-01T10:00:00Z" },
            counts: { have: 3, partial: 2, missing: 4 },
            top_gaps: [],
          },
        };
      if (path.endsWith("/report"))
        return {
          status: 200,
          body: {
            percent: null,
            snapshot: null,
            assessment: null,
            counts: { have: 0, partial: 0, missing: 0 },
            top_gaps: [],
          },
        };
      if (path.endsWith("/plan")) return notFound;
      if (path.endsWith("/qa-manual")) return { status: 200, body: qaDetail(true) };
      return {
        status: 200,
        body: { ...qaDetail(true), slug: "java-dev", progress: { studied: 0, total: 30 } },
      };
    });
    renderAt("/dashboard", routes);
    expect(await screen.findByText("Мои профессии")).toBeInTheDocument();
    expect(screen.getByText("Текущий шаг")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Продолжить/ })).toHaveAttribute(
      "href",
      "/professions/qa-manual/plan",
    );
    expect(screen.getByText("42%")).toBeInTheDocument();
    // java без активности — не в списке, но есть ссылка добавить
    expect(screen.queryByRole("link", { name: "Java-разработчик" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Добавить профессию" })).toBeInTheDocument();
    expect(screen.queryByText("Пройти онбординг")).not.toBeInTheDocument();
  });
});
