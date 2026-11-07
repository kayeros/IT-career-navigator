import { describe, expect, it } from "vitest";
import type { ProfessionDetail } from "../../api/types";
import { buildPlan, planTiming } from "./buildPlan";

const topic = (
  id: number,
  extra: Partial<{ studied: boolean; optional: boolean; hours: number }> = {},
) => ({
  id,
  slug: `t${id}`,
  title: `Тема ${id}`,
  description: null,
  hours: extra.hours ?? 4,
  optional: extra.optional ?? false,
  studied: extra.studied ?? false,
  resources: [],
});

const detail: ProfessionDetail = {
  slug: "qa",
  title: "QA",
  status: "available",
  progress: { studied: 1, total: 4 },
  blocks: [
    {
      id: 1,
      title: "Основы",
      topics: [topic(1, { studied: true }), topic(2), topic(3, { optional: true })],
    },
    { id: 2, title: "Инструменты", topics: [topic(2), topic(4, { hours: 6 })] },
  ],
};

describe("buildPlan", () => {
  it("берёт неизученные обязательные темы по порядку и без повторов", () => {
    expect(buildPlan(detail).map((i) => i.topicId)).toEqual([2, 4]);
  });

  it("считает часы и срок", () => {
    const t = planTiming(buildPlan(detail), 5, new Date(2026, 10, 6));
    expect(t.total).toBe(10);
    expect(t.weeks).toBe(2);
    expect(t.end.getDate()).toBe(20);
  });
});
