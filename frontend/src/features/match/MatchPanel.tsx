import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { formatMonth, formatPercent, formatShare } from "../../lib/format";
import { useMatch } from "./useMatch";

/** % соответствия вакансиям и топ недостающих навыков (GET /professions/{slug}/match). */
export function MatchPanel({
  slug,
  loggedIn,
  compact = false,
}: {
  slug: string;
  loggedIn: boolean;
  compact?: boolean;
}) {
  const { data, error, isPending, refetch } = useMatch(slug, loggedIn);

  if (!loggedIn) {
    return (
      <div className="panel stack items-start">
        <span className="eyebrow">Соответствие вакансиям</span>
        <p className="muted fs-14">
          Войдите и отмечайте изученные темы: посчитаем, на сколько процентов вы подходите под
          требования вакансий.
        </p>
        <Link
          className="btn ghost sm"
          to={`/login?next=${encodeURIComponent(`/professions/${slug}`)}`}
        >
          Войти
        </Link>
      </div>
    );
  }
  if (isPending)
    return (
      <div className="panel stack" aria-busy="true">
        <Skeleton height={88} width={88} />
        <Skeleton height={14} />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  if (data.percent === null || !data.snapshot) {
    return (
      <div className="panel stack items-start">
        <span className="eyebrow">Соответствие вакансиям</span>
        <p className="muted fs-14">
          Данных о вакансиях по этой профессии пока недостаточно. Процент появится после ближайшего
          расчёта.
        </p>
      </div>
    );
  }

  const p = Math.round(data.percent);
  return (
    <div className="panel stack gap-14 match-panel">
      <div className="row nowrap gap-16 items-center gap-head">
        <div className="ring ring-sm" style={{ "--p": p } as CSSProperties}>
          <b className="big-badge">{p}%</b>
        </div>
        <div className="stack gap-6 min-0">
          <span className="eyebrow">Соответствие вакансиям</span>
          <span className="muted fs-14">
            Закрыто {data.key_skills_covered} из {data.key_skills_total} ключевых навыков (
            {formatPercent(data.percent)}). Сравнили с {data.snapshot.vacancy_count} вакансиями за{" "}
            {formatMonth(data.snapshot.period)}.
          </span>
          {data.snapshot.preliminary && (
            <div>
              <span className="chip amber" title="Вакансий меньше 200: цифры могут измениться">
                Предварительные данные
              </span>
            </div>
          )}
        </div>
      </div>
      {!compact &&
        (data.missing.length > 0 ? (
          <div className="stack gap-8">
            <span className="eyebrow">Не хватает чаще всего</span>
            <div className="miss-list">
              {data.missing.map((s) => {
                const topic = s.topics.find((t) => !t.studied) ?? s.topics[0];
                const body = (
                  <>
                    <span className="miss-name">
                      {s.name}
                      {s.level === 0.5 && <span className="muted"> · частично</span>}
                    </span>
                    <span className="miss-bar" aria-hidden="true">
                      <i style={{ width: formatShare(s.weight) }} />
                    </span>
                    <span className="miss-pct" title="Доля вакансий с навыком">
                      {formatShare(s.weight)}
                    </span>
                  </>
                );
                return topic ? (
                  <Link
                    key={s.skill_id}
                    to={`#${topic.slug}`}
                    className="miss-item"
                    aria-label={`${s.name}: нужен в ${formatShare(s.weight)} вакансий. Открыть тему «${topic.title}»`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={s.skill_id} className="miss-item">
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <span className="chip good">Все ключевые навыки закрыты</span>
        ))}
    </div>
  );
}
