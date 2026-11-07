import type { ProfessionDetail } from "../../api/types";
import { applyStudied } from "./useToggleStudied";

const topic = (id: number, studied: boolean) => ({
  id,
  slug: `t${id}`,
  title: `Тема ${id}`,
  description: null,
  hours: 2,
  optional: false,
  studied,
  resources: [],
});

const detail: ProfessionDetail = {
  slug: "qa-manual",
  title: "QA",
  description: null,
  for_whom: null,
  status: "available",
  progress: { studied: 1, total: 2 },
  blocks: [
    { id: 1, title: "Блок 1", topics: [topic(10, true), topic(11, false)] },
    { id: 2, title: "Блок 2", topics: [topic(11, false)] },
  ],
};

describe("applyStudied", () => {
  it("отмечает тему во всех блоках и считает её один раз", () => {
    const next = applyStudied(detail, { topicId: 11, studied: true });
    expect(next.blocks[0].topics[1].studied).toBe(true);
    expect(next.blocks[1].topics[0].studied).toBe(true);
    expect(next.progress).toEqual({ studied: 2, total: 2 });
  });

  it("повторная отметка не меняет прогресс", () => {
    const next = applyStudied(detail, { topicId: 10, studied: true });
    expect(next.progress).toEqual({ studied: 1, total: 2 });
  });
});
