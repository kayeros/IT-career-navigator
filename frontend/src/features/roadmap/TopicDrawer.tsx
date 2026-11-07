import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Block, Topic } from "../../api/types";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { formatHours } from "../../lib/format";
import { ResourceList } from "../profession/ResourceList";
import type { Selection } from "./RoadmapMap";

type Props = {
  blocks: Block[];
  selection: Selection;
  loggedIn: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (s: Exclude<Selection, null>) => void;
  onToggle: (topic: Topic) => void;
};

/** Боковая панель темы или блока, как в прототипе (openDrawer). */
export function TopicDrawer({
  blocks,
  selection,
  loggedIn,
  pending,
  error,
  onClose,
  onSelect,
  onToggle,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const open = selection !== null;

  // Фокус в панель при открытии и обратно на тему после закрытия; Escape закрывает
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    document.body.classList.add("drawer-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("drawer-open");
      document.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  // При смене темы внутри панели фокус — на крестик, чтобы чтение начиналось сверху
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>(".x")?.focus({ preventScroll: true });
  }, [open, selection]);

  let body = null;
  if (selection?.kind === "topic") {
    const block = blocks.find((b) => b.topics.some((t) => t.id === selection.id));
    const topic = block?.topics.find((t) => t.id === selection.id);
    if (block && topic) {
      const next = encodeURIComponent(location.pathname + location.hash);
      body = (
        <>
          <div className="stack gap-8 pr-36">
            <span className="eyebrow">{block.title}</span>
            <h2 id="drawer-title">{topic.title}</h2>
            <div className="row gap-6">
              {topic.studied && <span className="chip good">Изучено</span>}
              {topic.optional && (
                <span className="chip">
                  <i className="lg-opt-chip" aria-hidden="true" />
                  Не обязательно для junior
                </span>
              )}
            </div>
          </div>
          <p>{topic.description || "Описание темы скоро появится."}</p>
          <div className="grid2 cols-2 gap-14">
            <div className="stack gap-6">
              <span className="eyebrow">Время</span>
              <b className="mono">≈ {formatHours(topic.hours)}</b>
            </div>
            <div className="stack gap-6">
              <span className="eyebrow">Материалов</span>
              <b className="mono">{topic.resources.length}</b>
            </div>
          </div>
          <div className="stack gap-8">
            <span className="eyebrow">Материалы для изучения</span>
            <ResourceList resources={topic.resources} />
          </div>
          <div className="stack gap-10 mt-auto">
            {error && <Banner tone="error">{error}</Banner>}
            {loggedIn ? (
              <Button
                variant={topic.studied ? "ghost" : "primary"}
                loading={pending}
                aria-pressed={topic.studied}
                onClick={() => onToggle(topic)}
              >
                {topic.studied ? "Изучено ✓ (снять отметку)" : "Изучено"}
              </Button>
            ) : (
              <>
                <Link className="btn primary" to={`/login?next=${next}`}>
                  Войти, чтобы отметить «Изучено»
                </Link>
                <span className="muted fs-13">
                  Отметки сохраняются в аккаунте и засчитываются во всех профессиях.
                </span>
              </>
            )}
          </div>
        </>
      );
    }
  } else if (selection?.kind === "block") {
    const block = blocks.find((b) => b.id === selection.id);
    if (block) {
      const hours = block.topics.reduce((s, t) => s + t.hours, 0);
      const studied = block.topics.filter((t) => t.studied).length;
      body = (
        <>
          <div className="stack gap-8 pr-36">
            <span className="eyebrow">Блок</span>
            <h2 id="drawer-title">{block.title}</h2>
          </div>
          <div className="grid2 cols-2 gap-14">
            <div className="stack gap-6">
              <span className="eyebrow">Время</span>
              <b className="mono">≈ {formatHours(hours)}</b>
            </div>
            <div className="stack gap-6">
              <span className="eyebrow">Тем</span>
              <b className="mono">
                {loggedIn ? `${studied} из ${block.topics.length}` : block.topics.length}
              </b>
            </div>
          </div>
          {block.topics.length > 0 ? (
            <div className="stack gap-6">
              <span className="eyebrow">Что входит</span>
              <div className="row gap-6">
                {block.topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip chip-btn ${t.studied ? "good" : ""}`}
                    onClick={() => onSelect({ kind: "topic", id: t.id })}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">В блоке пока нет тем.</p>
          )}
        </>
      );
    }
  }

  return (
    <>
      {open && body && <div className="drawer-backdrop" aria-hidden="true" onClick={onClose} />}
      <div
        ref={ref}
        className={`drawer${open && body ? " open" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="drawer-title"
        aria-hidden={!(open && body)}
      >
        {open && body && (
          <>
            <button type="button" className="x" aria-label="Закрыть" onClick={onClose}>
              ×
            </button>
            {body}
          </>
        )}
      </div>
    </>
  );
}
