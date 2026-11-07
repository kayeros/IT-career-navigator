import type { ProfessionDetail } from "../../api/types";

export type PlanItem = {
  topicId: number;
  slug: string;
  title: string;
  block: string;
  hours: number;
};

/**
 * План без ИИ (резервный алгоритм из mvp-plan): темы в порядке карты,
 * без изученных и без необязательных для junior; тема из нескольких блоков — один раз.
 */
export function buildPlan(detail: ProfessionDetail): PlanItem[] {
  const seen = new Set<number>();
  const items: PlanItem[] = [];
  for (const b of detail.blocks) {
    for (const t of b.topics) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      if (t.studied || t.optional) continue;
      items.push({ topicId: t.id, slug: t.slug, title: t.title, block: b.title, hours: t.hours });
    }
  }
  return items;
}

/** Срок при темпе hoursPerWeek часов в неделю. */
export function planTiming(items: PlanItem[], hoursPerWeek: number, from = new Date()) {
  const total = items.reduce((s, i) => s + i.hours, 0);
  const weeks = Math.ceil(total / Math.max(1, hoursPerWeek));
  const end = new Date(from);
  end.setDate(end.getDate() + weeks * 7);
  return { total, weeks, end };
}
