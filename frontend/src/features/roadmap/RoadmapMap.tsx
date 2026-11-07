import type { Block, Topic } from "../../api/types";
import { roadmapLayout } from "./layout";

export type Selection = { kind: "block"; id: number } | { kind: "topic"; id: number } | null;

type Props = {
  blocks: Block[];
  selection: Selection;
  onSelect: (s: Exclude<Selection, null>) => void;
  /** Показывать на блоках «изучено N из M» (для вошедшего) */
  showCounts?: boolean;
};

function nodeClass(kind: "main" | "sub", topic: Topic | undefined, selected: boolean) {
  const cls = ["node", kind];
  if (topic?.studied) cls.push("done");
  else if (topic?.optional) cls.push("optn");
  if (selected) cls.push("sel");
  return cls.join(" ");
}

function nodeLabel(title: string, topic?: Topic) {
  if (!topic) return `Блок «${title}»`;
  const parts = [title];
  if (topic.studied) parts.push("изучено");
  if (topic.optional) parts.push("не обязательно для junior");
  return parts.join(", ");
}

/** Карта профессии: на широком экране — схема, на телефоне — список (переключает CSS прототипа). */
function NodeContent({
  title,
  topic,
  block,
  showCounts,
}: {
  title: string;
  topic?: Topic;
  block?: Block;
  showCounts?: boolean;
}) {
  if (topic)
    return (
      <>
        {topic.studied && (
          <span className="node-check" aria-hidden="true">
            ✓
          </span>
        )}
        <span>{title}</span>
      </>
    );
  const studied = block ? block.topics.filter((t) => t.studied).length : 0;
  return (
    <>
      <span>{title}</span>
      {showCounts && block && block.topics.length > 0 && (
        <span className={`node-count${studied === block.topics.length ? " full" : ""}`}>
          {studied}/{block.topics.length}
        </span>
      )}
    </>
  );
}

export function RoadmapMap({ blocks, selection, onSelect, showCounts = false }: Props) {
  const L = roadmapLayout(blocks);
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const isSel = (kind: "block" | "topic", id: number) =>
    selection?.kind === kind && selection.id === id;

  return (
    <>
      <div className="rm-scroll">
        <div className="rm" style={{ width: L.W, height: L.H }}>
          <svg width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} aria-hidden="true">
            {L.lines.map((l) =>
              l.spine ? (
                <path key={l.key} d={l.d} stroke="var(--spine)" strokeWidth={3} fill="none" />
              ) : (
                <path
                  key={l.key}
                  d={l.d}
                  stroke="var(--spine)"
                  strokeWidth={1.6}
                  strokeDasharray="1 5"
                  strokeLinecap="round"
                  fill="none"
                />
              ),
            )}
          </svg>
          {L.nodes.map((n) => {
            const block = blockById.get(n.blockId)!;
            const topic =
              n.topicId != null ? block.topics.find((t) => t.id === n.topicId) : undefined;
            const title = topic ? topic.title : block.title;
            return (
              <button
                key={n.key}
                type="button"
                className={nodeClass(
                  n.kind,
                  topic,
                  topic ? isSel("topic", topic.id) : isSel("block", block.id),
                )}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
                aria-label={nodeLabel(title, topic)}
                onClick={() =>
                  onSelect(
                    topic ? { kind: "topic", id: topic.id } : { kind: "block", id: block.id },
                  )
                }
              >
                <NodeContent
                  title={title}
                  topic={topic}
                  block={topic ? undefined : block}
                  showCounts={showCounts}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rm-list">
        {blocks.map((b) => (
          <div key={b.id} className="rl-step">
            <button
              type="button"
              className={nodeClass("main", undefined, isSel("block", b.id))}
              onClick={() => onSelect({ kind: "block", id: b.id })}
            >
              <NodeContent title={b.title} block={b} showCounts={showCounts} />
            </button>
            {b.topics.length > 0 && (
              <div className="rl-subs">
                {b.topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={nodeClass("sub", t, isSel("topic", t.id))}
                    aria-label={nodeLabel(t.title, t)}
                    onClick={() => onSelect({ kind: "topic", id: t.id })}
                  >
                    <NodeContent title={t.title} topic={t} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
