import { useQueries } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api, isApiError, unwrap } from "../api/client";
import type { Plan, ProfessionDetail, ProfessionSummary, Report } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../features/auth/useAuth";
import { useProfessions } from "../features/catalog/useProfessions";
import { professionKey } from "../features/profession/useProfession";
import { useProfile } from "../features/profile/useProfile";
import { formatDate, formatHours } from "../lib/format";
import { lookStyle, professionLook } from "../lib/professionIcons";

type Row = {
  p: ProfessionSummary;
  detail?: ProfessionDetail;
  plan?: Plan | null;
  report?: Report;
};

/** Сводки по профессии — те же ключи кэша, что у карточки, плана и отчёта. */
function professionQueries(slug: string) {
  return [
    {
      queryKey: professionKey(slug),
      queryFn: () => unwrap(api.GET("/professions/{slug}", { params: { path: { slug } } })),
    },
    {
      queryKey: ["plan", slug],
      queryFn: async () => {
        try {
          return await unwrap(api.GET("/professions/{slug}/plan", { params: { path: { slug } } }));
        } catch (e) {
          if (isApiError(e) && e.code === "not_found") return null;
          throw e;
        }
      },
    },
    {
      queryKey: ["report", slug],
      queryFn: () => unwrap(api.GET("/professions/{slug}/report", { params: { path: { slug } } })),
    },
  ] as const;
}

/** Личный кабинет: текущий шаг, мои профессии, краткий отчёт. */
export default function DashboardPage() {
  const { user } = useAuth();
  const profile = useProfile();
  const professions = useProfessions();
  const available = (professions.data ?? []).filter((p) => p.status === "available");

  // На MVP профессий 3, поэтому собираем сводку отдельными запросами по каждой
  const results = useQueries({
    queries: available.flatMap((p) => professionQueries(p.slug)),
  });
  const pending = professions.isPending || results.some((r) => r.isPending);
  const failed = professions.error ?? results.find((r) => r.isError)?.error;

  const rows: Row[] = available.map((p, i) => ({
    p,
    detail: results[i * 3]?.data as ProfessionDetail | undefined,
    plan: results[i * 3 + 1]?.data as Plan | null | undefined,
    report: results[i * 3 + 2]?.data as Report | undefined,
  }));
  const active = rows.filter(
    (r) => r.plan || r.report?.assessment || (r.detail?.progress?.studied ?? 0) > 0,
  );
  const withPlan = active.filter((r) => r.plan).sort(byPlanDate);
  const current = withPlan[0];
  const currentItem = current?.plan?.items.find((it) => it.id === current.plan?.current_item_id);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Личный кабинет</span>
          <h1 className="mt-8 dash-h1">Здравствуйте, {user?.name}</h1>
        </div>
        <div className="row">
          <Link className="btn ghost" to="/professions">
            Каталог профессий
          </Link>
          <Link className="btn ghost" to="/profile">
            Профиль и настройки
          </Link>
        </div>
      </div>

      {profile.data && !profile.data.onboarding_completed && (
        <div className="banner info mb-20">
          <span>
            <b>Расскажите о себе за минуту.</b> Часы в неделю и срок нужны, чтобы посчитать план.
          </span>
          <Link className="btn primary sm" to="/onboarding">
            Пройти онбординг
          </Link>
        </div>
      )}

      {failed ? (
        <ErrorState
          error={failed}
          onRetry={() => {
            void professions.refetch();
            results.forEach((r) => r.isError && void r.refetch());
          }}
        />
      ) : pending ? (
        <div className="grid2 cols-even">
          <Skeleton height={180} />
          <Skeleton height={180} />
        </div>
      ) : active.length === 0 ? (
        <div className="panel stack items-start">
          <h2>С чего начать</h2>
          <p className="muted">
            Выберите профессию, отмечайте на карте то, что уже знаете, и пройдите оценку навыков —
            покажем, сколько не хватает до требований вакансий.
          </p>
          <div className="row">
            <Link className="btn primary" to="/professions">
              Выбрать профессию
            </Link>
            <Link className="btn ghost" to="/quiz">
              Не знаю, что выбрать
            </Link>
          </div>
        </div>
      ) : (
        <>
          {current?.plan && (
            <div className="grid2 cols-even mb-20">
              <div className="panel stack">
                <span className="eyebrow">Прогресс по плану · {current.p.title}</span>
                <div className="row nowrap gap-16 items-center">
                  <div
                    className="ring ring-sm ring-good"
                    style={{ "--p": current.plan.progress.percent } as CSSProperties}
                  >
                    <b className="big-badge">{current.plan.progress.percent}%</b>
                  </div>
                  <span className="muted fs-14">
                    Изучено {formatHours(current.plan.progress.studied_hours)} из{" "}
                    {formatHours(current.plan.progress.total_hours)}
                    {current.plan.ready_date && (
                      <>. Готовность — к {formatDate(current.plan.ready_date)}</>
                    )}
                  </span>
                </div>
              </div>
              <Link
                className="panel stack topic-card dash-next"
                to={`/professions/${current.p.slug}/plan`}
              >
                <span className="eyebrow">Текущий шаг</span>
                {currentItem ? (
                  <>
                    <h2>{currentItem.topic.title}</h2>
                    <span className="muted fs-14">
                      Неделя {currentItem.week_no} · около {formatHours(currentItem.hours)}
                    </span>
                  </>
                ) : (
                  <h2>Все темы плана изучены</h2>
                )}
                <span className="btn primary self-start">Продолжить →</span>
              </Link>
            </div>
          )}

          <h2 className="mb-16">Мои профессии</h2>
          <div className="dash-list">
            {active.map((r) => (
              <ProfessionRow key={r.p.slug} row={r} />
            ))}
          </div>
          {active.length < available.length && (
            <p className="muted fs-14 mt-16">
              Можно вести несколько профессий сразу: отметки «Изучено» общие для всех.{" "}
              <Link to="/professions" className="link-accent">
                Добавить профессию
              </Link>
            </p>
          )}
        </>
      )}
    </>
  );
}

function byPlanDate(a: Row, b: Row) {
  return (b.plan?.created_at ?? "").localeCompare(a.plan?.created_at ?? "");
}

function ProfessionRow({ row }: { row: Row }) {
  const { p, detail, plan, report } = row;
  const look = professionLook(p.slug);
  const prog = detail?.progress;
  const assessed = Boolean(report?.assessment);
  const percent = report?.percent;

  return (
    <article className="panel dash-prof">
      <div className="row nowrap gap-14 items-center min-0">
        <span className="pk-i" style={lookStyle(p.slug)} aria-hidden="true">
          {look.icon}
        </span>
        <div className="stack gap-4 min-0">
          <Link to={`/professions/${p.slug}`} className="dash-title">
            {p.title}
          </Link>
          <span className="muted fs-13">
            {prog ? `Изучено тем: ${prog.studied} из ${prog.total}` : "Карта профессии"}
          </span>
        </div>
      </div>

      <div className="dash-cells">
        <div className="stat">
          <span>Соответствие вакансиям</span>
          <b className="mono">{percent == null ? "—" : `${Math.round(percent)}%`}</b>
        </div>
        <div className="stat">
          <span>{assessed ? "Пробелы" : "Оценка навыков"}</span>
          <b className="mono">
            {assessed && report ? report.counts.missing + report.counts.partial : "нет"}
          </b>
        </div>
        <div className="stat">
          <span>План</span>
          <b className="mono">{plan ? `${plan.progress.percent}%` : "нет"}</b>
        </div>
      </div>

      <div className="row dash-actions">
        {plan ? (
          <Link className="btn primary sm" to={`/professions/${p.slug}/plan`}>
            Открыть план
          </Link>
        ) : assessed ? (
          <Link className="btn primary sm" to={`/professions/${p.slug}/plan`}>
            Построить план
          </Link>
        ) : (
          <Link className="btn primary sm" to={`/professions/${p.slug}/assess`}>
            Пройти оценку
          </Link>
        )}
        {assessed && (
          <Link className="btn ghost sm" to={`/professions/${p.slug}/report`}>
            Отчёт
          </Link>
        )}
      </div>
    </article>
  );
}
