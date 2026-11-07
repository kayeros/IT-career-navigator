import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { formatHours, formatMonth, formatShare, plural } from "../../lib/format";
import { useMatch } from "./useMatch";

type Progress = { studied: number; total: number };

/** Сколько навыков показывать в строке «Потом»; остальные — по кнопке «+N». */
const CHIPS_SHOWN = 5;

/**
 * Сводка над картой профессии: главное — следующий шаг.
 * Сверху мелко цифры (соответствие вакансиям из GET /professions/{slug}/match и прогресс по карте),
 * крупно — самый востребованный недостающий навык и тема, которая его закрывает,
 * ниже — остальные недостающие навыки чипами.
 */
export function ProfessionSummary({
  slug,
  progress,
  leftHours,
  topicHours,
}: {
  slug: string;
  progress: Progress;
  leftHours: number;
  /** Часы темы по её slug — из карты профессии (в ответе match их нет). */
  topicHours: Map<string, number>;
}) {
  const { data, error, isPending, refetch } = useMatch(slug, true);
  const [all, setAll] = useState(false);
  const assessHref = `/professions/${slug}/assess`;
  const mapPct = progress.total ? Math.round((progress.studied / progress.total) * 100) : 0;

  if (isPending)
    return (
      <section className="panel prof-next" aria-busy="true">
        <Skeleton height={16} width={360} />
        <Skeleton height={84} />
        <Skeleton height={28} width={420} />
      </section>
    );
  if (error)
    return (
      <section className="panel prof-next">
        <ErrorState error={error} onRetry={() => refetch()} />
      </section>
    );

  const snap = data.percent === null ? null : data.snapshot;
  const p = Math.round(data.percent ?? 0);
  const [first, ...rest] = snap ? data.missing : [];
  const firstTopic = first && (first.topics.find((t) => !t.studied) ?? first.topics[0]);
  const firstHours = firstTopic ? topicHours.get(firstTopic.slug) : undefined;
  const hidden = rest.length - CHIPS_SHOWN;
  const shown = all || hidden <= 0 ? rest : rest.slice(0, CHIPS_SHOWN);

  return (
    <section className="panel prof-next" aria-label="Ваша сводка по профессии">
      <div className="ps-stats fs-14">
        {snap && (
          <span
            className="ps-stat"
            title={`Закрыто ${data.key_skills_covered} из ${data.key_skills_total} ключевых навыков · по ${snap.vacancy_count} вакансиям за ${formatMonth(snap.period)}`}
          >
            <b className="ps-num">{p}%</b> подходите вакансиям
            <span className="ps-bar" aria-hidden="true">
              <i style={{ width: `${p}%` }} />
            </span>
            {snap.preliminary && (
              <span className="chip amber" title="Вакансий меньше 200: цифры могут измениться">
                предварительно
              </span>
            )}
          </span>
        )}
        <span className="ps-stat">
          <b>
            Изучено {progress.studied} из {progress.total}
          </b>{" "}
          {plural(progress.total, ["темы", "тем", "тем"])}
          <span className="ps-bar good" aria-hidden="true">
            <i style={{ width: `${mapPct}%` }} />
          </span>
        </span>
        <span className="muted">
          {leftHours > 0
            ? `≈${Math.round(leftHours)} ч до конца карты`
            : "Обязательные темы изучены"}
        </span>
      </div>

      {!snap ? (
        <div className="ps-step">
          <div>
            <small>Считаем требования рынка</small>
            <h3>Отмечайте изученные темы на карте</h3>
            <p className="muted">
              Вакансий по профессии пока мало. Процент и список недостающих навыков появятся после
              ближайшего расчёта, а отметки «Изучено» уже учитываются.
            </p>
          </div>
          <Link className="btn primary" to={assessHref}>
            Пройти оценку →
          </Link>
        </div>
      ) : first ? (
        <div className="ps-step">
          <div>
            <small>Начните с этого</small>
            <h3>
              {first.level === 0.5 ? `Подтяните ${first.name}` : first.name} — нужен в{"\u00a0"}
              {formatShare(first.weight)} вакансий
            </h3>
            <p className="muted">
              {firstTopic
                ? `Тема «${firstTopic.title}»${firstHours ? `, около ${formatHours(firstHours).replace(" ", "\u00a0")}` : ""}.`
                : "Тему для этого навыка команда ещё добавляет."}
            </p>
          </div>
          {firstTopic && (
            <Link className="btn primary" to={`#${firstTopic.slug}`}>
              Открыть тему →
            </Link>
          )}
        </div>
      ) : (
        <div className="ps-step">
          <div>
            <small>Отличный результат</small>
            <h3>Все ключевые навыки закрыты</h3>
            <p className="muted">Подтвердите уровень оценкой, так процент станет точнее.</p>
          </div>
          <Link className="btn primary" to={assessHref}>
            Пройти оценку →
          </Link>
        </div>
      )}

      {snap && first && (
        <div className="ps-more fs-14">
          {rest.length > 0 && <span className="muted">Потом:</span>}
          {shown.map((s) => {
            const topic = s.topics.find((t) => !t.studied) ?? s.topics[0];
            const share = formatShare(s.weight);
            const label = (
              <>
                {s.name}
                {s.level === 0.5 && " (частично)"} <i>{share}</i>
              </>
            );
            return topic ? (
              <Link
                key={s.skill_id}
                to={`#${topic.slug}`}
                className="skill-chip"
                title={`Нужен в ${share} вакансий. Открыть тему «${topic.title}»`}
                aria-label={`${s.name}: нужен в ${share} вакансий. Открыть тему «${topic.title}»`}
              >
                {label}
              </Link>
            ) : (
              <span key={s.skill_id} className="skill-chip" title={`Нужен в ${share} вакансий`}>
                {label}
              </span>
            );
          })}
          {hidden > 0 && (
            <button
              type="button"
              className="skill-chip"
              aria-expanded={all}
              onClick={() => setAll((v) => !v)}
            >
              {all ? "Свернуть" : `+${hidden}`}
            </button>
          )}
          <Link className="ps-assess" to={assessHref}>
            Уточнить процент оценкой →
          </Link>
        </div>
      )}
    </section>
  );
}
