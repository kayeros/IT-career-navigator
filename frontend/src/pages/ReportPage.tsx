import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { useProfession } from "../features/profession/useProfession";
import { useReport } from "../features/report/useReport";
import { formatDate, formatMonth, formatPercent, formatShare } from "../lib/format";

/** Краткий отчёт о разрыве: %, есть / частично / не хватает, топ-3 пробела. Полный — по подписке (позже). */
export default function ReportPage() {
  const { slug = "" } = useParams();
  const prof = useProfession(slug);
  const report = useReport(slug);

  if (prof.isPending || report.isPending)
    return (
      <div className="stack" aria-busy="true">
        <Skeleton height={40} width="60%" />
        <Skeleton height={300} />
      </div>
    );
  if (prof.error) return <ErrorState error={prof.error} onRetry={() => prof.refetch()} />;
  if (report.error) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;

  const r = report.data;
  if (!r.assessment)
    return (
      <div className="panel stack narrow-panel">
        <span className="eyebrow">Отчёт о разрыве · {prof.data.title}</span>
        <h2>Отчёта пока нет</h2>
        <p className="muted">
          Пройдите оценку навыков (около 10 минут), чтобы увидеть, чего не хватает до требований
          вакансий.
        </p>
        <Link className="btn primary" to={`/professions/${slug}/assess`}>
          Пройти оценку
        </Link>
      </div>
    );

  const total = r.counts.have + r.counts.partial + r.counts.missing;
  const p = r.percent === null ? null : Math.round(r.percent);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            Отчёт о разрыве · краткий · оценка от{" "}
            {formatDate(r.assessment.completed_at.slice(0, 10))}
          </span>
          <h1 className="mt-8">
            {p === null ? "Данные о вакансиях ещё собираются" : `Вы подходите вакансиям на ${p}%`}
          </h1>
        </div>
        <div className="row">
          <Link className="btn primary" to={`/professions/${slug}/plan`}>
            Построить план
          </Link>
          <Link className="btn ghost" to={`/professions/${slug}/assess`}>
            Пройти заново
          </Link>
        </div>
      </div>

      <div className="report-grid">
        <div className="panel report-main">
          <div className="ring" style={{ "--p": p ?? 0 } as CSSProperties}>
            <b>{p === null ? "—" : `${p}%`}</b>
          </div>
          <div className="stack gap-8 min-0">
            <h3>{prof.data.title}, junior</h3>
            {r.snapshot ? (
              <p className="muted fs-14">
                {formatPercent(r.percent ?? 0)} — по {r.snapshot.vacancy_count} вакансиям за{" "}
                {formatMonth(r.snapshot.period)}. Учтены ответы оценки и темы, отмеченные «Изучено».
              </p>
            ) : (
              <p className="muted fs-14">Процент появится после ближайшего расчёта по вакансиям.</p>
            )}
            {r.snapshot?.preliminary && (
              <div>
                <span className="chip amber">Предварительная оценка: вакансий пока меньше 200</span>
              </div>
            )}
          </div>
        </div>
        <div className="report-counts">
          <div className="panel stat rc-have">
            <span>Есть</span>
            <b className="mono">{r.counts.have}</b>
            <span>из {total} навыков</span>
          </div>
          <div className="panel stat rc-partial">
            <span>Частично</span>
            <b className="mono">{r.counts.partial}</b>
            <span>базовый уровень</span>
          </div>
          <div className="panel stat rc-missing">
            <span>Не хватает</span>
            <b className="mono">{r.counts.missing}</b>
            <span>стоит изучить</span>
          </div>
        </div>
      </div>

      <div className="panel stack gap-16 mt-20">
        <div className="row">
          <h2>Три главных пробела</h2>
          <span className="chip">по доле вакансий</span>
        </div>
        {r.top_gaps.length === 0 ? (
          <span className="chip good self-start">Пробелов нет — все ключевые навыки закрыты</span>
        ) : (
          <ol className="gaps">
            {r.top_gaps.map((g, i) => (
              <li key={g.skill_id} className="gap-item">
                <span className="gap-n">{i + 1}</span>
                <div className="stack gap-6 min-0">
                  <b>
                    {g.name}
                    {g.level === 0.5 && <span className="muted fw-500"> · знаете частично</span>}
                  </b>
                  <span className="muted fs-14">Нужен в {formatShare(g.weight)} вакансий</span>
                  {g.topics.length > 0 && (
                    <span className="row gap-6">
                      {g.topics.map((t) => (
                        <Link
                          key={t.id}
                          to={`/professions/${slug}#${t.slug}`}
                          className={`chip ${t.studied ? "good" : "accent"}`}
                        >
                          {t.title}
                          {t.studied ? " ✓" : " →"}
                        </Link>
                      ))}
                    </span>
                  )}
                </div>
                <div className="gap-meter" aria-hidden="true">
                  <i style={{ width: formatShare(g.weight) }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="panel locked-teaser mt-20">
        <div className="stack gap-6">
          <b>Полный отчёт — с подпиской</b>
          <span className="muted fs-14">
            Все навыки профессии по уровням и что закрыть в первую очередь. Появится вместе с
            подпиской.
          </span>
        </div>
        <span className="chip">скоро</span>
      </div>
    </>
  );
}
