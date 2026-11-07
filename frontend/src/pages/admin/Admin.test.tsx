import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { USER } from "../../test/fixtures";
import { mockFetch, renderAt } from "../../test/render";
import AdminLayout from "./AdminLayout";
import ProfessionContentAdmin from "./ProfessionContentAdmin";
import TermsAdmin from "./TermsAdmin";

const ADMIN = { ...USER, role: "admin" };
const routes = [
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { path: "terms", element: <TermsAdmin /> },
      { path: "professions/:id", element: <ProfessionContentAdmin /> },
    ],
  },
];

describe("Админка", () => {
  it("обычному пользователю — «Нет доступа»", async () => {
    mockFetch(() => ({ status: 200, body: USER }));
    renderAt("/admin/terms", routes);
    expect(await screen.findByText("Нет доступа")).toBeInTheDocument();
  });

  it("термин из вакансий можно сделать синонимом навыка", async () => {
    const patches: unknown[] = [];
    mockFetch((method, path, body) => {
      if (path.endsWith("/me")) return { status: 200, body: ADMIN };
      if (path.endsWith("/admin/skills"))
        return {
          status: 200,
          body: [{ id: 33, name: "SQL", status: "verified", source: "manual", synonyms: [] }],
        };
      if (path.endsWith("/admin/unknown-terms/7") && method === "PATCH") {
        patches.push(body);
        return { status: 200, body: {} };
      }
      if (path.endsWith("/admin/unknown-terms"))
        return {
          status: 200,
          body: [
            {
              id: 7,
              term: "postgres",
              occurrences: 12,
              status: "new",
              skill_id: null,
              first_seen_at: "2026-10-01T00:00:00Z",
              last_seen_at: "2026-11-01T00:00:00Z",
            },
          ],
        };
      return { status: 404 };
    });
    renderAt("/admin/terms", routes);
    const row = (await screen.findByText("postgres")).closest("tr")!;
    const syn = within(row).getByRole("button", { name: "Синоним" });
    expect(syn).toBeDisabled();
    await userEvent.selectOptions(within(row).getByLabelText(/Навык для синонима/), "33");
    await userEvent.click(syn);
    expect(patches).toEqual([{ status: "became_synonym", skill_id: 33 }]);
  });

  it("порядок тем блока меняется стрелками и сохраняется целиком", async () => {
    const puts: unknown[] = [];
    mockFetch((method, path, body) => {
      if (path.endsWith("/me")) return { status: 200, body: ADMIN };
      if (path.endsWith("/admin/professions"))
        return {
          status: 200,
          body: [{ id: 1, slug: "qa-manual", title: "QA", status: "available", sort_order: 1 }],
        };
      if (path.endsWith("/admin/professions/1/blocks"))
        return {
          status: 200,
          body: [
            {
              id: 5,
              title: "Основы",
              sort_order: 1,
              topics: [
                { id: 10, slug: "a", title: "Тема А", optional: false },
                { id: 11, slug: "b", title: "Тема Б", optional: true },
              ],
            },
          ],
        };
      if (path.endsWith("/admin/blocks/5/topics") && method === "PUT") {
        puts.push(body);
        return { status: 204 };
      }
      return { status: 200, body: [] };
    });
    renderAt("/admin/professions/1", routes);
    await userEvent.click(await screen.findByRole("button", { name: "Ниже: Тема А" }));
    expect(puts).toEqual([
      [
        { topic_id: 11, optional: true },
        { topic_id: 10, optional: false },
      ],
    ]);
  });
});
