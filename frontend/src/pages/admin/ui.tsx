import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";

/** Загрузка / ошибка / пусто / данные — одинаково во всех разделах. */
export function QueryView<T>({
  q,
  empty,
  children,
}: {
  q: UseQueryResult<T[]>;
  empty: string;
  children: (items: T[]) => ReactNode;
}) {
  if (q.isPending) return <Skeleton height={220} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data.length) return <p className="muted panel">{empty}</p>;
  return <>{children(q.data)}</>;
}

/** Фильтр по статусу: «Все» + варианты. */
export function StatusTabs<S extends string>({
  value,
  options,
  onChange,
}: {
  value: S | undefined;
  options: Record<S, string>;
  onChange: (v: S | undefined) => void;
}) {
  const entries = Object.entries(options) as [S, string][];
  return (
    <div className="tabs adm-tabs" role="group" aria-label="Фильтр по статусу">
      <button
        type="button"
        className={value ? "" : "on"}
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
      >
        Все
      </button>
      {entries.map(([k, t]) => (
        <button
          key={k}
          type="button"
          className={value === k ? "on" : ""}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function AdminHead({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="adm-head">
      <div className="stack gap-4">
        <h1>{title}</h1>
        {hint && <p className="muted fs-14">{hint}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

const TONE: Record<string, string> = {
  verified: "good",
  approved: "good",
  available: "good",
  became_skill: "good",
  became_synonym: "good",
  in_review: "amber",
  ai_suggested: "amber",
  soon: "amber",
  new: "accent",
  rejected: "bad",
};

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`chip ${TONE[status] ?? ""}`}>{label}</span>;
}
