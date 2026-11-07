import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_MATCH, makePlan, PROFILE, qaDetail, USER } from "../test/fixtures";
import { mockFetch, renderAt } from "../test/render";
import PlanPage from "./PlanPage";

const routes = [{ path: "/professions/:slug/plan", element: <PlanPage /> }];

function api(hasPlan: boolean) {
  let plan = hasPlan ? makePlan() : null;
  const studied = new Set<number>();
  return mockFetch((method, path, body) => {
    if (path.endsWith("/me")) return { status: 200, body: USER };
    if (path.endsWith("/me/profile")) return { status: 200, body: PROFILE };
    if (path.endsWith("/match")) return { status: 200, body: EMPTY_MATCH };
    if (path.endsWith("/plan")) {
      if (method === "POST") {
        plan = makePlan({
          hours_per_week: (body as { hours_per_week: number }).hours_per_week,
          late: false,
        });
        return { status: 201, body: plan };
      }
      return plan
        ? {
            status: 200,
            body: {
              ...plan,
              items: plan.items.map((i) => ({
                ...i,
                studied: i.studied || studied.has(i.topic.id),
              })),
            },
          }
        : { status: 404, body: { error: { code: "not_found", message: "" } } };
    }
    const t = /topics\/(\d+)\/progress$/.exec(path);
    if (t && method === "PUT") {
      studied.add(Number(t[1]));
      return { status: 204 };
    }
    if (path.includes("/topics/")) return { status: 204 };
    return { status: 200, body: qaDetail(true) };
  });
}

describe("PlanPage", () => {
  it("плана нет — форма с часами из профиля строит план", async () => {
    const fetch = api(false);
    renderAt("/professions/qa-manual/plan", routes);
    const hours = await screen.findByLabelText("Часов в неделю");
    await waitFor(() => expect(hours).toHaveValue(8));
    await userEvent.clear(hours);
    await userEvent.type(hours, "50");
    await userEvent.click(screen.getByRole("button", { name: "Построить план" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("от 2 до 40");
    await userEvent.clear(hours);
    await userEvent.type(hours, "12");
    await userEvent.click(screen.getByRole("button", { name: "Построить план" }));
    expect(await screen.findByText("Неделя 1")).toBeInTheDocument();
    const post = fetch.mock.calls.find(([r]) => r instanceof Request && r.method === "POST");
    expect(post).toBeTruthy();
  });

  it("план: недели, текущий шаг, предупреждение о дедлайне, отметка «Изучено»", async () => {
    const fetch = api(true);
    renderAt("/professions/qa-manual/plan", routes);
    expect(await screen.findByText("Неделя 2")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("15 ч");
    const first = screen.getByText("Тест-дизайн", { selector: "b" }).closest("li")!;
    expect(within(first).getByText("Текущий шаг")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Изучено: Git"));
    await waitFor(() => expect(screen.getByLabelText("Изучено: Git")).toBeChecked());
    expect(
      fetch.mock.calls.some(
        ([r]) =>
          r instanceof Request && r.method === "PUT" && r.url.endsWith("/topics/13/progress"),
      ),
    ).toBe(true);
  });
});
