import type { ProfessionDetail, ProfessionSummary } from "../api/types";

export const USER = {
  id: 1,
  email: "ivan@example.ru",
  name: "Иван",
  role: "user",
  email_verified: true,
};

export const PROFESSIONS: ProfessionSummary[] = [
  {
    slug: "qa-manual",
    title: "Ручное тестирование (QA)",
    description: "Проверяет продукт",
    for_whom: null,
    status: "available",
    blocks_count: 2,
    topics_count: 4,
  },
  {
    slug: "java-dev",
    title: "Java-разработчик",
    description: null,
    for_whom: null,
    status: "available",
    blocks_count: 7,
    topics_count: 30,
  },
  {
    slug: "frontend",
    title: "Frontend-разработчик",
    description: null,
    for_whom: null,
    status: "soon",
    blocks_count: 0,
    topics_count: 0,
  },
];

const topic = (
  id: number,
  slug: string,
  title: string,
  extra: { studied?: boolean; optional?: boolean; hours?: number } = {},
) => ({
  id,
  slug,
  title,
  description: `Описание темы ${title}`,
  hours: extra.hours ?? 4,
  optional: extra.optional ?? false,
  studied: extra.studied ?? false,
  resources: [
    {
      id: id * 10,
      title: `Материал ${title}`,
      url: "https://example.org/",
      type: "article" as const,
      language: "ru",
      is_free: true,
    },
    {
      id: id * 10 + 1,
      title: "Опасная ссылка",
      url: "javascript:alert(1)",
      type: "article" as const,
      language: "ru",
      is_free: true,
    },
  ],
});

export function qaDetail(loggedIn: boolean): ProfessionDetail {
  return {
    slug: "qa-manual",
    title: "Ручное тестирование (QA)",
    description: "Проверяет продукт",
    for_whom: "Внимательным",
    status: "available",
    progress: loggedIn ? { studied: 1, total: 4 } : null,
    blocks: [
      {
        id: 1,
        title: "Основы",
        topics: [
          topic(10, "qa-theory", "Теория тестирования", { studied: loggedIn }),
          topic(11, "qa-design", "Тест-дизайн", { hours: 6 }),
        ],
      },
      {
        id: 2,
        title: "Инструменты",
        topics: [
          topic(12, "sql", "SQL", { optional: true }),
          topic(13, "git", "Git"),
          topic(11, "qa-design", "Тест-дизайн", { hours: 6 }),
        ],
      },
    ],
  };
}

export const EMPTY_MATCH = {
  percent: null,
  snapshot: null,
  key_skills_total: 0,
  key_skills_covered: 0,
  missing: [],
};

export const PROFILE = {
  learner_status: null,
  course: null,
  hours_per_week: 8,
  deadline: null,
  months_learning: null,
  learned_unneeded: null,
  onboarding_completed: false,
};

export function makePlan(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    profession_slug: "qa-manual",
    version_no: 1,
    built_by: "algorithm",
    created_at: "2026-11-09T10:00:00Z",
    hours_per_week: 8,
    deadline: "2026-11-20",
    total_hours: 20,
    ready_date: "2026-11-30",
    late: true,
    hours_per_week_needed: 15,
    match_before: 24.2,
    match_after: 61,
    progress: { studied_hours: 0, total_hours: 20, percent: 0 },
    current_item_id: 1,
    items: [
      {
        id: 1,
        sort_order: 1,
        topic: { id: 11, slug: "qa-design", title: "Тест-дизайн" },
        hours: 6,
        week_no: 1,
        status: "to_learn",
        studied: false,
        skills: ["Тест-дизайн"],
      },
      {
        id: 2,
        sort_order: 2,
        topic: { id: 13, slug: "git", title: "Git" },
        hours: 4,
        week_no: 1,
        status: "to_learn",
        studied: false,
        skills: ["Git"],
      },
      {
        id: 3,
        sort_order: 3,
        topic: { id: 12, slug: "sql", title: "SQL" },
        hours: 10,
        week_no: 2,
        status: "optional",
        studied: false,
        skills: ["SQL"],
      },
    ],
    ...over,
  };
}
