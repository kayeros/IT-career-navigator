import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, unwrap } from "../../api/client";
import { Button } from "../../components/Button";
import {
  useAdminAction,
  useAdminBlocks,
  useAdminProfessions,
  useAdminProfessionSkills,
  useAdminSkills,
  useAdminTopics,
  type AdminBlock,
  type AdminProfessionSkill,
} from "../../features/admin/useAdmin";
import { AdminHead, QueryView } from "./ui";

/** Контент профессии: блоки → темы по порядку и навыки профессии. */
export default function ProfessionContentAdmin() {
  const id = Number(useParams().id);
  const professions = useAdminProfessions();
  const prof = professions.data?.find((p) => p.id === id);
  const [tab, setTab] = useState<"blocks" | "skills">("blocks");

  return (
    <>
      <Link className="btn link" to="/admin/professions">
        ← Все профессии
      </Link>
      <AdminHead
        title={prof?.title ?? "Профессия"}
        hint={
          prof && (
            <>
              Адрес <span className="mono">{prof.slug}</span> ·{" "}
              <Link className="link-accent" to={`/professions/${prof.slug}`}>
                открыть карточку на сайте
              </Link>
            </>
          )
        }
      />
      <div className="tabs adm-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "blocks"}
          className={tab === "blocks" ? "on" : ""}
          onClick={() => setTab("blocks")}
        >
          Блоки и темы
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "skills"}
          className={tab === "skills" ? "on" : ""}
          onClick={() => setTab("skills")}
        >
          Навыки профессии
        </button>
      </div>
      {tab === "blocks" ? <Blocks professionId={id} /> : <ProfessionSkills professionId={id} />}
    </>
  );
}

function Blocks({ professionId }: { professionId: number }) {
  const q = useAdminBlocks(professionId);
  const [title, setTitle] = useState("");
  const create = useAdminAction(
    (t: string) =>
      unwrap(
        api.POST("/admin/professions/{id}/blocks", {
          params: { path: { id: professionId } },
          body: { title: t, sort_order: (q.data?.length ?? 0) + 1 },
        }),
      ),
    "Блок добавлен",
  );
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(title.trim(), { onSuccess: () => setTitle("") });
  };

  return (
    <div className="stack gap-16">
      <QueryView q={q} empty="Блоков пока нет — добавьте первый.">
        {(blocks) =>
          [...blocks]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((b) => <BlockCard key={b.id} block={b} />)
        }
      </QueryView>
      <form className="panel row adm-inline" onSubmit={onAdd}>
        <label htmlFor="nb-title" className="sr-only">
          Название нового блока
        </label>
        <input
          id="nb-title"
          placeholder="Название нового блока, например «Основы тестирования»"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
          Добавить блок
        </Button>
      </form>
    </div>
  );
}

type TopicRow = AdminBlock["topics"][number];

function BlockCard({ block }: { block: AdminBlock }) {
  const [title, setTitle] = useState(block.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);

  const rename = useAdminAction(
    (body: { title?: string; sort_order?: number }) =>
      unwrap(api.PATCH("/admin/blocks/{id}", { params: { path: { id: block.id } }, body })),
    "Блок сохранён",
  );
  const remove = useAdminAction(
    () => unwrap(api.DELETE("/admin/blocks/{id}", { params: { path: { id: block.id } } })),
    "Блок удалён, темы остались в библиотеке",
  );
  const setTopics = useAdminAction((topics: TopicRow[]) =>
    unwrap(
      api.PUT("/admin/blocks/{id}/topics", {
        params: { path: { id: block.id } },
        body: topics.map((t) => ({ topic_id: t.id, optional: t.optional })),
      }),
    ),
  );

  const topics = block.topics;
  const move = (i: number, d: -1 | 1) => {
    const next = [...topics];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setTopics.mutate(next);
  };

  return (
    <article className="panel stack gap-12 adm-block">
      <div className="row between">
        <form
          className="row adm-inline grow"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && title.trim() !== block.title)
              rename.mutate({ title: title.trim() });
          }}
        >
          <span className="mono muted">{block.sort_order}.</span>
          <label htmlFor={`bt-${block.id}`} className="sr-only">
            Название блока
          </label>
          <input id={`bt-${block.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          {title.trim() !== block.title && (
            <Button type="submit" size="sm" loading={rename.isPending}>
              Сохранить
            </Button>
          )}
        </form>
        {confirmDelete ? (
          <span className="row gap-6">
            <span className="fs-13">Удалить блок?</span>
            <Button size="sm" loading={remove.isPending} onClick={() => remove.mutate(undefined)}>
              Да, удалить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Нет
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="link" onClick={() => setConfirmDelete(true)}>
            Удалить блок
          </Button>
        )}
      </div>

      {topics.length === 0 ? (
        <p className="muted fs-14">В блоке нет тем.</p>
      ) : (
        <ol className="adm-topics">
          {topics.map((t, i) => (
            <li key={t.id}>
              <span className="grow min-0">
                <b>{t.title}</b> <span className="mono muted fs-12">{t.slug}</span>
              </span>
              <label className="check fs-13">
                <input
                  type="checkbox"
                  checked={t.optional}
                  disabled={setTopics.isPending}
                  onChange={() =>
                    setTopics.mutate(
                      topics.map((x) => (x.id === t.id ? { ...x, optional: !x.optional } : x)),
                    )
                  }
                />
                не обязательна
              </label>
              <span className="row gap-4 nowrap">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Выше: ${t.title}`}
                  disabled={i === 0 || setTopics.isPending}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Ниже: ${t.title}`}
                  disabled={i === topics.length - 1 || setTopics.isPending}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Убрать из блока: ${t.title}`}
                  disabled={setTopics.isPending}
                  onClick={() => setTopics.mutate(topics.filter((x) => x.id !== t.id))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {adding ? (
        <TopicPicker
          exclude={topics.map((t) => t.id)}
          onPick={(t) =>
            setTopics.mutate([...topics, { ...t, optional: false }], {
              onSuccess: () => setAdding(false),
            })
          }
          onClose={() => setAdding(false)}
        />
      ) : (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
          + Тема из библиотеки
        </Button>
      )}
    </article>
  );
}

function TopicPicker({
  exclude,
  onPick,
  onClose,
}: {
  exclude: number[];
  onPick: (t: { id: number; slug: string; title: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = useAdminTopics(query.trim());
  const found = (q.data ?? []).filter((t) => !exclude.includes(t.id)).slice(0, 8);
  return (
    <div className="adm-picker stack gap-8">
      <div className="row adm-inline">
        <label htmlFor="tp-q" className="sr-only">
          Поиск темы
        </label>
        <input
          id="tp-q"
          autoFocus
          placeholder="Найти тему по названию или адресу"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Готово
        </Button>
      </div>
      {found.length ? (
        <ul className="adm-found">
          {found.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onPick(t)}>
                <b>{t.title}</b> <span className="mono muted fs-12">{t.slug}</span>
                <span className="muted fs-12">{t.hours} ч</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted fs-13">
          {q.isPending ? "Ищем…" : "Ничего не нашлось. Новую тему можно создать в разделе "}
          {!q.isPending && (
            <Link to="/admin/topics" className="link-accent">
              «Темы»
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

function ProfessionSkills({ professionId }: { professionId: number }) {
  const q = useAdminProfessionSkills(professionId);
  const all = useAdminSkills();
  const [pick, setPick] = useState("");
  const save = useAdminAction(
    (list: AdminProfessionSkill[]) =>
      unwrap(
        api.PUT("/admin/professions/{id}/skills", {
          params: { path: { id: professionId } },
          body: list.map(({ skill_id, is_key }) => ({ skill_id, is_key })),
        }),
      ),
    "Навыки профессии сохранены",
  );
  const items = q.data ?? [];
  const free = (all.data ?? []).filter((s) => !items.some((i) => i.skill_id === s.id));

  return (
    <div className="stack gap-16">
      <p className="muted fs-14">
        Ключевые навыки участвуют в оценке и в проценте соответствия. Вес считает сервис аналитики
        по вакансиям.
      </p>
      <QueryView q={q} empty="Навыков у профессии пока нет.">
        {(list) => (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Навык</th>
                  <th>Ключевой</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.skill_id}>
                    <td>{s.name}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Ключевой: ${s.name}`}
                        checked={s.is_key}
                        disabled={save.isPending}
                        onChange={() =>
                          save.mutate(
                            list.map((x) =>
                              x.skill_id === s.skill_id ? { ...x, is_key: !x.is_key } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="adm-actions">
                      <Button
                        variant="link"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => save.mutate(list.filter((x) => x.skill_id !== s.skill_id))}
                      >
                        Убрать
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
      <form
        className="panel row adm-inline"
        onSubmit={(e) => {
          e.preventDefault();
          const s = free.find((x) => String(x.id) === pick);
          if (!s) return;
          save.mutate([...items, { skill_id: s.id, name: s.name, is_key: true }], {
            onSuccess: () => setPick(""),
          });
        }}
      >
        <label htmlFor="ps-pick" className="sr-only">
          Навык из справочника
        </label>
        <select id="ps-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Навык из справочника…</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.status !== "verified" ? " (не проверен)" : ""}
            </option>
          ))}
        </select>
        <Button type="submit" loading={save.isPending} disabled={!pick}>
          Добавить
        </Button>
      </form>
    </div>
  );
}
