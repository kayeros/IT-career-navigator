import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { qaDetail, USER } from "../test/fixtures";
import { mockFetch, renderAt } from "../test/render";
import AssessPage from "./AssessPage";

const routes = [
  { path: "/professions/:slug/assess", element: <AssessPage /> },
  { path: "/professions/:slug/report", element: <p>отчёт</p> },
];

const assessment = (answeredFirst: boolean) => ({
  id: 7,
  profession_slug: "qa-manual",
  status: "in_progress",
  started_at: "2026-11-07T10:00:00Z",
  completed_at: null,
  skills: [
    {
      skill_id: 1,
      name: "Git",
      question: null,
      answer: answeredFirst ? { self_level: "basic", level: 0.5, check_passed: null } : null,
    },
    {
      skill_id: 2,
      name: "SQL",
      question: { id: 5, text: "Что вернёт COUNT(*)?", options: ["Число строк", "Сумму"] },
      answer: null,
    },
  ],
});

const puts: unknown[] = [];

function api(opts: { answeredFirst?: boolean; tooSoon?: boolean } = {}) {
  puts.length = 0;
  return mockFetch((method, path, body) => {
    if (path.endsWith("/me")) return { status: 200, body: USER };
    if (path.endsWith("/assessments"))
      return opts.tooSoon
        ? {
            status: 409,
            body: { error: { code: "too_soon", message: "Пройти заново можно с 14 ноября" } },
          }
        : { status: 200, body: assessment(Boolean(opts.answeredFirst)) };
    const m = /answers\/(\d+)$/.exec(path);
    if (m && method === "PUT") {
      const b = body as { self_level: string };
      puts.push(body);
      return {
        status: 200,
        body: {
          ...assessment(false).skills[Number(m[1]) - 1],
          answer: { self_level: b.self_level, level: 1, check_passed: true },
        },
      };
    }
    if (path.endsWith("/complete")) return { status: 200, body: {} };
    return { status: 200, body: qaDetail(true) };
  });
}

describe("AssessPage", () => {
  it("продолжает с первого неотвеченного навыка; «уверенно» требует проверочный вопрос", async () => {
    api({ answeredFirst: true });
    const { router } = renderAt("/professions/qa-manual/assess", routes);
    expect(await screen.findByText("«SQL»")).toBeInTheDocument();
    expect(screen.getByText(/навык 2 из 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Уверенно/));
    expect(screen.getByText("Что вернёт COUNT(*)?")).toBeInTheDocument();
    const finish = screen.getByRole("button", { name: "Завершить и посмотреть отчёт" });
    expect(finish).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Число строк"));
    await userEvent.click(finish);
    expect(await screen.findByText("отчёт")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/professions/qa-manual/report");
    expect(puts).toEqual([{ self_level: "confident", check_option: 0 }]);
  });

  it("повторная оценка раньше срока — объясняем и ведём в отчёт", async () => {
    api({ tooSoon: true });
    renderAt("/professions/qa-manual/assess", routes);
    expect(await screen.findByText("Пройти заново можно с 14 ноября")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть отчёт" })).toBeInTheDocument();
  });
});
