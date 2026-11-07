import { useState, type FormEvent } from "react";
import { api, isApiError, unwrap } from "../../api/client";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  RESOURCE_STATUS,
  useAdminAction,
  useAdminResources,
  useAdminSkills,
  useAdminTopics,
  type AdminTopic,
  orNull,
} from "../../features/admin/useAdmin";
import { AdminHead, QueryView } from "./ui";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Общая библиотека тем: тема хранится один раз и ставится в блоки разных профессий. */
export default function TopicsAdmin() {
  const [query, setQuery] = useState("");
  const q = useAdminTopics(query.trim());
  const [editing, setEditing] = useState<AdminTopic | "new" | null>(null);

  return (
    <>
      <AdminHead
        title="Темы"
        hint="Библиотека общая: тема, изученная в одной профессии, засчитывается во всех."
      >
        <Button onClick={() => setEditing("new")}>Новая тема</Button>
      </AdminHead>
      {editing && (
        <TopicForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <div className="field mb-16 search-field">
        <label htmlFor="at-q">Поиск</label>
        <input
          id="at-q"
          type="search"
          placeholder="Название или адрес"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <QueryView q={q} empty={query ? "Ничего не нашлось." : "Тем пока нет."}>
        {(items) => (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Тема</th>
                  <th>Адрес</th>
                  <th>Часы</th>
                  <th>Навыки</th>
                  <th>Материалы</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.title}</b>
                    </td>
                    <td className="mono fs-13">{t.slug}</td>
                    <td className="mono">{t.hours}</td>
                    <td className="mono">{t.skill_ids.length}</td>
                    <td className="mono">
                      {t.resource_ids.length || <span className="chip bad">0</span>}
                    </td>
                    <td className="adm-actions">
                      <Button variant="link" size="sm" onClick={() => setEditing(t)}>
                        Изменить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </>
  );
}

function TopicForm({ initial, onClose }: { initial: AdminTopic | null; onClose: () => void }) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [hours, setHours] = useState(String(initial?.hours ?? 4));
  const [skillIds, setSkillIds] = useState<number[]>(initial?.skill_ids ?? []);
  const [resourceIds, setResourceIds] = useState<number[]>(initial?.resource_ids ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const skills = useAdminSkills();
  const resources = useAdminResources();

  const save = useAdminAction(
    async () => {
      const body = {
        title: title.trim(),
        description: orNull(description),
        hours: Number(hours.replace(",", ".")),
      };
      const topic = initial
        ? await unwrap(
            api.PATCH("/admin/topics/{id}", { params: { path: { id: initial.id } }, body }),
          )
        : await unwrap(api.POST("/admin/topics", { body: { ...body, slug } }));
      const path = { params: { path: { id: topic.id } } };
      await unwrap(api.PUT("/admin/topics/{id}/skills", { ...path, body: { ids: skillIds } }));
      await unwrap(
        api.PUT("/admin/topics/{id}/resources", { ...path, body: { ids: resourceIds } }),
      );
      return topic;
    },
    initial ? "Тема сохранена" : "Тема создана",
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!initial && !SLUG_RE.test(slug)) next.slug = "Латиница, цифры и дефисы: test-design";
    if (!title.trim()) next.title = "Укажите название";
    const h = Number(hours.replace(",", "."));
    if (!Number.isFinite(h) || h < 0) next.hours = "Число часов, например 6 или 1.5";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(undefined, {
      onSuccess: onClose,
      onError: (err) => {
        if (isApiError(err) && Object.keys(err.fields).length) setErrors(err.fields);
        else if (isApiError(err) && err.status === 409)
          setErrors({ slug: "Такой адрес уже занят" });
      },
    });
  };

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <form className="panel stack mb-20 adm-form" onSubmit={onSubmit} noValidate>
      <h3>{initial ? `Тема «${initial.title}»` : "Новая тема"}</h3>
      <div className="adm-form-grid">
        <Field
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <Field
          label="Адрес (slug)"
          value={slug}
          disabled={Boolean(initial)}
          onChange={(e) => setSlug(e.target.value.trim())}
          error={errors.slug}
          hint={initial ? "Не меняется: на него завязан прогресс" : "Например, test-design"}
        />
        <Field
          label="Часов с нуля"
          inputMode="decimal"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          error={errors.hours}
        />
      </div>
      <div className="field">
        <label htmlFor="at-desc">Краткое описание</label>
        <textarea
          id="at-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="adm-form-grid cols-2">
        <CheckList
          legend="Навыки, которые закрывает тема"
          items={(skills.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
          selected={skillIds}
          onToggle={(id) => toggle(skillIds, setSkillIds, id)}
        />
        <CheckList
          legend="Материалы (по порядку отметки)"
          items={(resources.data ?? []).map((r) => ({
            id: r.id,
            label: r.title,
            note: r.status === "approved" ? undefined : RESOURCE_STATUS[r.status],
          }))}
          selected={resourceIds}
          onToggle={(id) => toggle(resourceIds, setResourceIds, id)}
          hint="Пользователь увидит только одобренные."
        />
      </div>
      <div className="row">
        <Button type="submit" loading={save.isPending}>
          Сохранить
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function CheckList({
  legend,
  items,
  selected,
  onToggle,
  hint,
}: {
  legend: string;
  items: { id: number; label: string; note?: string }[];
  selected: number[];
  onToggle: (id: number) => void;
  hint?: string;
}) {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const shown = items.filter((i) => !f || i.label.toLowerCase().includes(f));
  return (
    <fieldset className="field adm-checklist">
      <legend>
        {legend} <span className="muted fw-400">· выбрано {selected.length}</span>
      </legend>
      <input
        type="search"
        aria-label={`Фильтр: ${legend}`}
        placeholder="Фильтр"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="adm-checklist-box">
        {shown.map((i) => (
          <label key={i.id} className="check">
            <input
              type="checkbox"
              checked={selected.includes(i.id)}
              onChange={() => onToggle(i.id)}
            />
            <span>
              {i.label}
              {i.note && <span className="chip amber ml-6">{i.note}</span>}
            </span>
          </label>
        ))}
        {!shown.length && <span className="muted fs-13">Пусто</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </fieldset>
  );
}
