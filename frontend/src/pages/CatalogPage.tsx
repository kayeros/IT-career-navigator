import { useState } from "react";
import { Link } from "react-router-dom";
import type { ProfessionSummary } from "../api/types";
import { ErrorState } from "../components/ErrorState";
import { LoadingLabel, Skeleton } from "../components/Skeleton";
import { LaunchNotify } from "../features/catalog/LaunchNotify";
import { useProfessions } from "../features/catalog/useProfessions";
import { lastProfession } from "../lib/lastProfession";
import { lookStyle, professionLook } from "../lib/professionIcons";

type Filter = "all" | "available" | "soon";
const FILTERS: [Filter, string][] = [
  ["all", "Все"],
  ["available", "Доступные"],
  ["soon", "Скоро"],
];

function CardHead({ p, viewed }: { p: ProfessionSummary; viewed: boolean }) {
  const live = p.status === "available";
  return (
    <>
      <div className="pc-head">
        <span className="pk-i" style={lookStyle(p.slug)}>
          {professionLook(p.slug).icon}
        </span>
        <div className="top-r">
          {live ? <span className="chip good">Доступно</span> : <span className="chip">Скоро</span>}
          {viewed && <span className="chip accent">Вы смотрели</span>}
        </div>
      </div>
      <div className="stack gap-6">
        <h3 className="pc-title">{p.title}</h3>
        {p.description && <p className="muted fs-14">{p.description}</p>}
      </div>
    </>
  );
}

export default function CatalogPage() {
  const { data, error, isPending, refetch } = useProfessions();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [viewed] = useState(lastProfession);

  const q = query.trim().toLowerCase();
  const all = data ?? [];
  const count = (f: Filter) => all.filter((p) => f === "all" || p.status === f).length;
  const list = all.filter(
    (p) => (filter === "all" || p.status === filter) && (!q || p.title.toLowerCase().includes(q)),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Каталог</span>
          <h1 className="mt-8">Профессии в IT</h1>
          <p className="muted">
            Выберите профессию: покажем карту тем по порядку изучения и сколько вам осталось до
            требований вакансий.
          </p>
        </div>
        <Link className="btn ghost" to="/quiz">
          Не знаю, что выбрать
        </Link>
      </div>

      <div className="row between mb-18">
        <div className="tabs m-0 inline-flex" role="group" aria-label="Фильтр профессий">
          {FILTERS.map(([v, t]) => (
            <button
              key={v}
              type="button"
              className={`${filter === v ? "on" : ""} px-16`}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {t}
              {data && <span className="tab-count">{count(v)}</span>}
            </button>
          ))}
        </div>
        <div className="field search-field">
          <label htmlFor="catSearch" className="sr-only">
            Поиск по названию
          </label>
          <input
            id="catSearch"
            type="text"
            placeholder="Поиск по названию"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {isPending ? (
        <div className="grid3" aria-busy="true">
          <LoadingLabel text="Загружаем профессии…" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="pcard stack">
              <Skeleton height={44} width={44} />
              <Skeleton height={20} width="70%" />
              <Skeleton height={14} />
              <Skeleton height={14} width="80%" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <div className="panel stack items-start">
          <p className="muted">
            {all.length === 0
              ? "Профессии скоро появятся."
              : `По запросу «${query.trim()}» ничего не нашлось.`}
          </p>
          {all.length > 0 && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => (setQuery(""), setFilter("all"))}
            >
              Сбросить поиск
            </button>
          )}
        </div>
      ) : (
        <div className="grid3">
          {list.map((p) =>
            p.status === "available" ? (
              <Link key={p.slug} to={`/professions/${p.slug}`} className="pcard">
                <CardHead p={p} viewed={p.slug === viewed} />
                <dl className="pc-stats">
                  <dt>Блоков</dt>
                  <dd>{p.blocks_count}</dd>
                  <dt>Тем</dt>
                  <dd>{p.topics_count}</dd>
                </dl>
                <span className="pc-go">Открыть карту →</span>
              </Link>
            ) : (
              <div key={p.slug} className="pcard stub">
                <CardHead p={p} viewed={false} />
                <div className="pc-stats pc-soon">
                  <span className="muted fs-13">Карту тем готовит команда</span>
                </div>
                <LaunchNotify slug={p.slug} title={p.title} />
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}
