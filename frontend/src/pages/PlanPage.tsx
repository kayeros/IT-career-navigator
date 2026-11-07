import { useQueryClient } from "@tanstack/react-query";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { isApiError } from "../api/client";
import type { Plan, PlanItem } from "../api/types";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/toastContext";
import { useBuildPlan, usePlan, useProfile } from "../features/plan/usePlan";
import { useProfession } from "../features/profession/useProfession";
import { useToggleStudied } from "../features/profession/useToggleStudied";
import { errorText, MESSAGES } from "../lib/errors";
import { formatDate, formatHours } from "../lib/format";
import { lastProfession } from "../lib/lastProfession";

/** «Мой план» в шапке: ведём к последней открытой профессии. */
export function MyPlanRedirect() {
  const slug = lastProfession();
  return <Navigate to={slug ? `/professions/${slug}/plan` : "/professions"} replace />;
}

const SHORT_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
const short = (d: Date) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;

/** «9–15 ноя» для недели плана, считая от даты построения. */
function weekRange(createdAt: string, week: number) {
  const start = new Date(createdAt.slice(0, 10) + "T00:00:00");
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${short(start)} – ${short(end)}`;
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);

export default function PlanPage() {
  const { slug = "" } = useParams();
  const prof = useProfession(slug);
  const plan = usePlan(slug);

  if (prof.isPending || plan.isPending)
    return (
      <div className="stack" aria-busy="true">
        <Skeleton height={40} width="50%" />
        <Skeleton height={90} />
        <Skeleton height={300} />
      </div>
    );
  if (prof.error) return <ErrorState error={prof.error} onRetry={() => prof.refetch()} />;
  if (plan.error) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />;

  if (!plan.data)
    return (
      <div className="panel stack narrow-panel">
        <span className="eyebrow">План обучения · {prof.data.title}</span>
        <h1 className="fs-28">Построим план</h1>
        <p className="muted">
          Возьмём навыки, которых не хватает, по важности для работодателей и разложим их темы по
          неделям под ваш темп. Точнее всего план получится после оценки навыков.
        </p>
        <PlanForm slug={slug} submitText="Построить план" />
        <Link className="btn link fs-14" to={`/professions/${slug}/assess`}>
          Сначала пройти оценку навыков →
        </Link>
      </div>
    );

  return <PlanView slug={slug} title={prof.data.title} plan={plan.data} />;
}

function PlanForm({
  slug,
  submitText,
  initial,
  onDone,
}: {
  slug: string;
  submitText: string;
  initial?: { hours: number; deadline: string | null };
  onDone?: () => void;
}) {
  const profile = useProfile();
  const build = useBuildPlan(slug);
  const toast = useToast();
  const [hours, setHours] = useState<string | null>(initial ? String(initial.hours) : null);
  const [deadline, setDeadline] = useState<string | null>(initial?.deadline ?? null);
  const [error, setError] = useState<string | null>(null);

  const hoursValue = hours ?? String(profile.data?.hours_per_week ?? 10);
  const deadlineValue = deadline ?? profile.data?.deadline ?? "";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const h = Number(hoursValue);
    if (!Number.isInteger(h) || h < 2 || h > 40) return setError("Часов в неделю: от 2 до 40");
    setError(null);
    build.mutate(
      { hours_per_week: h, deadline: deadlineValue || null },
      {
        onSuccess: (p) => {
          toast(p.version_no > 1 ? `План обновлён, версия ${p.version_no}` : "План построен");
          onDone?.();
        },
        onError: (err) => setError(errorText(err)),
      },
    );
  };

  return (
    <form className="plan-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="plan-hours">Часов в неделю</label>
        <input
          id="plan-hours"
          type="number"
          inputMode="numeric"
          min={2}
          max={40}
          value={hoursValue}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setHours(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="plan-deadline">Хочу найти работу к (необязательно)</label>
        <input
          id="plan-deadline"
          type="date"
          value={deadlineValue}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <Button type="submit" loading={build.isPending}>
        {submitText}
      </Button>
      {error && (
        <div className="plan-form-err">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </form>
  );
}

function PlanView({ slug, title, plan }: { slug: string; title: string; plan: Plan }) {
  const [editing, setEditing] = useState(false);
  const toggle = useToggleStudied(slug);
  const qc = useQueryClient();
  const toast = useToast();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const weeks = new Map<number, PlanItem[]>();
  for (const it of plan.items) weeks.set(it.week_no, [...(weeks.get(it.week_no) ?? []), it]);

  const onToggle = (it: PlanItem) => {
    setToggleError(null);
    const studied = !it.studied;
    // Сразу меняем галочку в плане; точные цифры придут после перезапроса
    qc.setQueryData<Plan>(["plan", slug], (p) =>
      p ? { ...p, items: p.items.map((x) => (x.id === it.id ? { ...x, studied } : x)) } : p,
    );
    toggle.mutate(
      { topicId: it.topic.id, studied },
      {
        onSuccess: () => toast(studied ? `«${it.topic.title}» — изучено` : "Отметка снята"),
        onError: (e) => {
          qc.invalidateQueries({ queryKey: ["plan", slug] });
          if (!(isApiError(e) && e.code === "unauthorized")) setToggleError(MESSAGES.toggleFailed);
        },
      },
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            План обучения · версия {plan.version_no} от {formatDate(plan.created_at.slice(0, 10))}
          </span>
          <h1 className="mt-8">{title}, junior</h1>
        </div>
        <div className="row">
          <Link className="btn ghost" to={`/professions/${slug}`}>
            Карта профессии
          </Link>
          <Button variant={editing ? "ghost" : "primary"} onClick={() => setEditing(!editing)}>
            {editing ? "Отмена" : "Обновить план"}
          </Button>
        </div>
      </div>

      {editing && (
        <div className="panel stack mb-20">
          <h3>Пересобрать план</h3>
          <p className="muted fs-14">
            Учтём новые отметки «Изучено» и последнюю оценку. Прежние версии плана сохраняются.
          </p>
          <PlanForm
            slug={slug}
            submitText="Пересобрать"
            initial={{ hours: plan.hours_per_week, deadline: plan.deadline }}
            onDone={() => setEditing(false)}
          />
        </div>
      )}

      {plan.late && (
        <div className="warn mb-20" role="alert">
          <b>!</b>
          <span>
            При {plan.hours_per_week} ч в неделю вы не успеваете к {formatDate(plan.deadline ?? "")}
            .
            {plan.hours_per_week_needed !== null && (
              <>
                {" "}
                Чтобы успеть, нужно около <b className="mono">{plan.hours_per_week_needed} ч</b> в
                неделю — или сдвиньте дедлайн.
              </>
            )}
          </span>
        </div>
      )}

      <div className="grid2 stat-grid mb-20">
        <div className="panel stat">
          <span>Всего учиться</span>
          <b className="mono">{formatHours(plan.total_hours)}</b>
          <span>{plan.items.length} тем</span>
        </div>
        <div className="panel stat">
          <span>Ваш темп</span>
          <b className="mono">{plan.hours_per_week} ч/нед</b>
          <span>{weeks.size} нед. в плане</span>
        </div>
        <div className="panel stat">
          <span>Будете готовы</span>
          <b>{formatDate(plan.ready_date)}</b>
          <span>
            {plan.deadline ? `дедлайн — ${formatDate(plan.deadline)}` : "дедлайн не задан"}
          </span>
        </div>
        <div className="panel stat">
          <span>Соответствие вакансиям</span>
          <b className="mono">
            {pct(plan.match_before)} → <span className="good-ink">{pct(plan.match_after)}</span>
          </b>
          <span>сейчас → после плана</span>
        </div>
      </div>

      <div className="grid2 cols-main-side">
        <div className="panel">
          <div className="row between mb-6">
            <h2>Что учить по неделям</h2>
            <span className="muted mono fs-13">{plan.progress.percent}% пройдено</span>
          </div>
          <div className="meter mb-14" aria-hidden="true">
            <i className="bar-good" style={{ width: `${plan.progress.percent}%` }} />
          </div>
          {toggleError && <Banner tone="error">{toggleError}</Banner>}
          {plan.items.length === 0 ? (
            <div className="stack items-start mt-12">
              <span className="chip good">Учить нечего — все нужные навыки закрыты</span>
            </div>
          ) : (
            [...weeks.entries()].map(([week, items]) => (
              <section key={week} className="plan-week">
                <h3 className="plan-week-h">
                  Неделя {week} <span className="muted">· {weekRange(plan.created_at, week)}</span>
                </h3>
                <ul className="timeline plan-list">
                  {items.map((it) => {
                    const cur = it.id === plan.current_item_id;
                    return (
                      <li
                        key={it.id}
                        className={`tl ${cur ? "cur" : ""} ${it.studied ? "done" : ""}`}
                      >
                        <label className="tl-check">
                          <input
                            type="checkbox"
                            checked={it.studied}
                            onChange={() => onToggle(it)}
                            aria-label={`Изучено: ${it.topic.title}`}
                          />
                          <span aria-hidden="true">✓</span>
                        </label>
                        <div className="stack gap-4 min-0">
                          <b>{it.topic.title}</b>
                          <div className="row gap-6">
                            {cur && <span className="chip amber">Текущий шаг</span>}
                            {it.status === "optional" && (
                              <span className="chip">не обязательно</span>
                            )}
                            {it.skills.map((s) => (
                              <span key={s} className="chip accent">
                                {s}
                              </span>
                            ))}
                            <Link
                              className="btn link fs-13"
                              to={`/professions/${slug}#${it.topic.slug}`}
                            >
                              Материалы →
                            </Link>
                          </div>
                        </div>
                        <span className="h">{formatHours(it.hours)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <div className="stack gap-20">
          <div className="panel stack gap-12">
            <h3>Прогресс</h3>
            <div className="row nowrap gap-16 items-center">
              <div
                className="ring ring-sm ring-good"
                style={{ "--p": plan.progress.percent } as CSSProperties}
              >
                <b className="big-badge">{plan.progress.percent}%</b>
              </div>
              <span className="muted fs-14">
                Изучено {formatHours(plan.progress.studied_hours)} из{" "}
                {formatHours(plan.progress.total_hours)}. Отмечайте темы галочкой — текущий шаг
                сдвинется сам.
              </span>
            </div>
            <Link className="btn link" to={`/professions/${slug}/report`}>
              Отчёт о разрыве →
            </Link>
          </div>
          <div className="panel stack">
            <h3>Как построен план</h3>
            <p className="muted fs-14">
              Сначала навыки, которых не хватает чаще всего в вакансиях, внутри — темы в порядке
              карты. Если навык вы знаете базово, на него заложена половина часов.
            </p>
            <span className="stub-note">
              {plan.built_by === "ai"
                ? "План составлен ИИ и проверен по справочнику."
                : "План построен алгоритмом без ИИ."}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
