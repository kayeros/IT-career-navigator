import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { isApiError } from "../api/client";
import type { ProfessionDetail, Topic } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/toastContext";
import { LoadingLabel, Skeleton } from "../components/Skeleton";
import { useAuth } from "../features/auth/useAuth";
import { MatchPanel } from "../features/match/MatchPanel";
import { useProfession } from "../features/profession/useProfession";
import { useToggleStudied } from "../features/profession/useToggleStudied";
import { RoadmapMap, type Selection } from "../features/roadmap/RoadmapMap";
import { TopicDrawer } from "../features/roadmap/TopicDrawer";
import { MESSAGES } from "../lib/errors";
import { buildPlan, planTiming } from "../features/plan/buildPlan";
import { lookStyle, professionLook } from "../lib/professionIcons";
import { saveLastProfession } from "../lib/lastProfession";
import NotFoundPage from "./NotFoundPage";

/** Выбранная тема или блок хранится в адресе: #<slug темы> или #block-<id>. Так ссылку можно переслать. */
function selectionFromHash(hash: string, data: ProfessionDetail | undefined): Selection {
  if (!data || !hash) return null;
  const h = decodeURIComponent(hash.slice(1));
  const m = /^block-(\d+)$/.exec(h);
  if (m) {
    const id = Number(m[1]);
    return data.blocks.some((b) => b.id === id) ? { kind: "block", id } : null;
  }
  for (const b of data.blocks) {
    const t = b.topics.find((x) => x.slug === h);
    if (t) return { kind: "topic", id: t.id };
  }
  return null;
}

function hashFor(s: Exclude<Selection, null>, data: ProfessionDetail): string {
  if (s.kind === "block") return `#block-${s.id}`;
  for (const b of data.blocks) {
    const t = b.topics.find((x) => x.id === s.id);
    if (t) return `#${t.slug}`;
  }
  return "";
}

/** Копия блока без отметок — чтобы посчитать полный объём профессии. */
const unstudy = (b: ProfessionDetail["blocks"][number]) => ({
  ...b,
  topics: b.topics.map((t) => ({ ...t, studied: false })),
});

export default function ProfessionPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const loggedIn = Boolean(user);
  const { data, error, isPending, refetch } = useProfession(slug);
  const toggle = useToggleStudied(slug);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const selection = selectionFromHash(location.hash, data);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} — Карьерный навигатор IT`;
    if (data.status === "available") saveLastProfession(data.slug);
    return () => {
      document.title = "Карьерный навигатор IT";
    };
  }, [data]);

  const select = useCallback(
    (s: Exclude<Selection, null>) => {
      if (!data) return;
      setToggleError(null);
      navigate({ hash: hashFor(s, data) }, { replace: true, preventScrollReset: true });
    },
    [data, navigate],
  );
  const close = useCallback(() => navigate({ hash: "" }, { replace: true }), [navigate]);

  if (isApiError(error) && error.code === "not_found")
    return <NotFoundPage title="Такой профессии нет" />;

  const onToggle = (topic: Topic) => {
    setToggleError(null);
    toggle.mutate(
      { topicId: topic.id, studied: !topic.studied },
      {
        onSuccess: () => toast(topic.studied ? "Отметка снята" : `«${topic.title}» — изучено`),
        onError: (e) => {
          // При 401 AuthProvider уже сбросил пользователя: панель покажет кнопку входа
          if (!(isApiError(e) && e.code === "unauthorized")) setToggleError(MESSAGES.toggleFailed);
        },
      },
    );
  };

  if (isPending)
    return (
      <div className="stack" aria-busy="true">
        <LoadingLabel text="Загружаем профессию…" />
        <Skeleton height={14} width={140} />
        <Skeleton height={40} width="50%" />
        <Skeleton height={16} width="80%" />
        <Skeleton height={320} />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const topicsTotal = new Set(data.blocks.flatMap((b) => b.topics.map((t) => t.id))).size;
  const pr = data.progress;
  const pct = pr && pr.total ? Math.round((pr.studied / pr.total) * 100) : 0;
  const soon = data.status === "soon";
  const totalHours = planTiming(buildPlan({ ...data, blocks: data.blocks.map(unstudy) }), 1).total;
  const leftHours = planTiming(buildPlan(data), 1).total;
  const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.hash)}`;

  return (
    <>
      <section className="prof-hero" style={lookStyle(data.slug)}>
        <div className="prof-hero-main">
          <nav className="prof-crumbs" aria-label="Навигация">
            <Link to="/professions">Каталог</Link>
            <span aria-hidden="true">/</span>
            <span>{data.title}</span>
          </nav>
          <div className="prof-title">
            <span className="pk-i pk-lg">{professionLook(data.slug).icon}</span>
            <h1>{data.title}</h1>
          </div>
          {data.description && <p className="prof-lead">{data.description}</p>}
          {data.for_whom && (
            <p className="prof-for">
              <b>Кому подходит</b>
              {data.for_whom}
            </p>
          )}
        </div>
        <div className="prof-hero-side">
          <dl className="prof-stats">
            <div>
              <dt>Блоков</dt>
              <dd>{data.blocks.length}</dd>
            </div>
            <div>
              <dt>Тем</dt>
              <dd>{topicsTotal}</dd>
            </div>
            <div>
              <dt>Учиться</dt>
              <dd>≈{Math.round(totalHours)} ч</dd>
            </div>
          </dl>
          {!soon && (
            <div className="prof-actions">
              <Link className="btn primary" to={`/professions/${slug}/assess`}>
                Узнать мои пробелы
              </Link>
              {loggedIn && (
                <Link className="btn ghost" to={`/professions/${slug}/plan`}>
                  Мой план
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {soon ? (
        <div className="panel">
          <p className="muted">Карта этой профессии появится позже.</p>
        </div>
      ) : (
        <>
          {pr ? (
            <div className="prof-summary">
              <div className="panel prof-progress">
                <div className="ring ring-sm ring-good" style={{ "--p": pct } as CSSProperties}>
                  <b className="big-badge">{pct}%</b>
                </div>
                <div className="stack gap-6 min-0">
                  <span className="eyebrow">Ваш прогресс</span>
                  <b className="fs-16">
                    Изучено {pr.studied} из {pr.total}
                  </b>
                  <span className="muted fs-14">
                    {leftHours > 0
                      ? `Осталось ≈${Math.round(leftHours)} ч обязательных тем`
                      : "Все обязательные темы изучены"}
                  </span>
                  <span
                    className="sr-only"
                    role="progressbar"
                    aria-label="Изучено тем"
                    aria-valuemin={0}
                    aria-valuemax={pr.total}
                    aria-valuenow={pr.studied}
                  />
                </div>
              </div>
              <MatchPanel slug={slug} loggedIn={loggedIn} />
            </div>
          ) : (
            <div className="prof-guest panel">
              <div className="stack gap-6 min-0">
                <b className="fs-16">
                  Отмечайте изученное и узнайте, насколько вы подходите вакансиям
                </b>
                <span className="muted fs-14">
                  Карту можно смотреть без входа. После входа отметки «Изучено» сохранятся, и мы
                  посчитаем % соответствия.
                </span>
              </div>
              <div className="row nowrap">
                <Link
                  className="btn primary"
                  to={`/register?next=${encodeURIComponent(location.pathname)}`}
                >
                  Создать аккаунт
                </Link>
                <Link className="btn ghost" to={loginHref}>
                  Войти
                </Link>
              </div>
            </div>
          )}

          <div className="rm-head">
            <h2>Карта профессии</h2>
            <div className="legend">
              <span>
                <i className="sw-known" />
                Изучено
              </span>
              <span>
                <i className="sw-learn" />
                Изучить
              </span>
              <span>
                <i className="lg-opt" />
                Не обязательно для junior
              </span>
            </div>
          </div>
          <p className="muted fs-14 mb-14">
            Блоки идут сверху вниз в порядке изучения. Нажмите на тему, чтобы открыть описание и
            материалы.
          </p>

          {data.blocks.length === 0 ? (
            <div className="panel">
              <p className="muted">Темы этой профессии скоро появятся.</p>
            </div>
          ) : (
            <RoadmapMap
              blocks={data.blocks}
              selection={selection}
              onSelect={select}
              showCounts={loggedIn}
            />
          )}

          <TopicDrawer
            blocks={data.blocks}
            selection={selection}
            loggedIn={loggedIn}
            pending={toggle.isPending}
            error={toggleError}
            onClose={close}
            onSelect={select}
            onToggle={onToggle}
          />
        </>
      )}
    </>
  );
}
