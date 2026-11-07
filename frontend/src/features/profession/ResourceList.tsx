import type { Resource } from "../../api/types";
import { isSafeUrl } from "../../lib/format";

const TYPE_LABEL: Record<Resource["type"], string> = {
  article: "Статья",
  video: "Видео",
  course: "Курс",
  docs: "Документация",
  practice: "Практика",
};

/** Материалы темы в стиле прототипа (.res). Ссылки — только http(s), в новой вкладке. */
export function ResourceList({ resources }: { resources: Resource[] }) {
  const safe = resources.filter((r) => isSafeUrl(r.url));
  if (safe.length === 0)
    return <p className="muted fs-14">Материалы к этой теме скоро появятся.</p>;

  return (
    <div className="res">
      {safe.map((r) => (
        <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer">
          <span className="chip accent">{TYPE_LABEL[r.type] ?? r.type}</span>
          <span className="grow min-0">{r.title}</span>
          <span className="mono muted fs-12">{r.language.toUpperCase()}</span>
          {r.is_free ? (
            <span className="chip good">Бесплатно</span>
          ) : (
            <span className="chip">Платно</span>
          )}
          <span className="sr-only"> (откроется в новой вкладке)</span>
        </a>
      ))}
    </div>
  );
}
