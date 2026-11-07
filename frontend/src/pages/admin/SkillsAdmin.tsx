import { useState, type FormEvent } from "react";
import { api, unwrap } from "../../api/client";
import { Button } from "../../components/Button";
import {
  SKILL_STATUS,
  useAdminAction,
  useAdminSkills,
  type AdminSkill,
  type AdminSkillInput,
  type SkillStatus,
  orNull,
} from "../../features/admin/useAdmin";
import { AdminHead, QueryView, StatusTabs } from "./ui";

/** Справочник навыков: по нему и синонимам collector находит навыки в вакансиях. */
export default function SkillsAdmin() {
  const [status, setStatus] = useState<SkillStatus | undefined>();
  const q = useAdminSkills(status);
  const [name, setName] = useState("");
  const create = useAdminAction(
    (n: string) => unwrap(api.POST("/admin/skills", { body: { name: n, status: "verified" } })),
    "Навык добавлен",
  );

  return (
    <>
      <AdminHead
        title="Навыки и синонимы"
        hint="Новые навыки из вакансий проходят статусы: новый → на проверке → проверен."
      />
      <form
        className="panel row adm-inline mb-16"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate(name.trim(), { onSuccess: () => setName("") });
        }}
      >
        <label htmlFor="as-new" className="sr-only">
          Новый навык
        </label>
        <input
          id="as-new"
          placeholder="Новый навык, например «Postman»"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          Добавить навык
        </Button>
      </form>
      <StatusTabs value={status} options={SKILL_STATUS} onChange={setStatus} />
      <QueryView q={q} empty="Навыков с таким статусом нет.">
        {(items) => (
          <div className="stack gap-12">
            {items.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        )}
      </QueryView>
    </>
  );
}

function SkillCard({ skill }: { skill: AdminSkill }) {
  const [name, setName] = useState(skill.name);
  const [comment, setComment] = useState(skill.review_comment ?? "");
  const [synonym, setSynonym] = useState("");

  const update = useAdminAction(
    (body: AdminSkillInput) =>
      unwrap(api.PATCH("/admin/skills/{id}", { params: { path: { id: skill.id } }, body })),
    "Навык сохранён",
  );
  const addSyn = useAdminAction(
    (s: string) =>
      unwrap(
        api.POST("/admin/skills/{id}/synonyms", {
          params: { path: { id: skill.id } },
          body: { synonym: s },
        }),
      ),
    "Синоним добавлен",
  );
  const delSyn = useAdminAction(
    (id: number) => unwrap(api.DELETE("/admin/synonyms/{id}", { params: { path: { id } } })),
    "Синоним удалён",
  );

  const dirty = name.trim() !== skill.name || comment.trim() !== (skill.review_comment ?? "");
  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    update.mutate({ name: name.trim(), review_comment: orNull(comment) });
  };

  return (
    <article className="panel stack gap-12">
      <form className="adm-skill-head" onSubmit={onSave}>
        <label htmlFor={`sk-${skill.id}`} className="sr-only">
          Название навыка
        </label>
        <input id={`sk-${skill.id}`} value={name} onChange={(e) => setName(e.target.value)} />
        <span className="chip">{skill.source === "vacancies" ? "из вакансий" : "вручную"}</span>
        <label htmlFor={`ss-${skill.id}`} className="sr-only">
          Статус
        </label>
        <select
          id={`ss-${skill.id}`}
          value={skill.status}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ status: e.target.value as SkillStatus })}
        >
          {Object.entries(SKILL_STATUS).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <input
          aria-label="Комментарий проверки"
          placeholder="Комментарий проверки"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {dirty && (
          <Button type="submit" size="sm" loading={update.isPending}>
            Сохранить
          </Button>
        )}
      </form>
      <div className="row gap-6">
        <span className="muted fs-13">Синонимы:</span>
        {skill.synonyms.map((s) => (
          <span key={s.id} className="chip adm-syn">
            {s.synonym}
            <button
              type="button"
              aria-label={`Удалить синоним ${s.synonym}`}
              disabled={delSyn.isPending}
              onClick={() => delSyn.mutate(s.id)}
            >
              ×
            </button>
          </span>
        ))}
        <form
          className="row gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (synonym.trim()) addSyn.mutate(synonym.trim(), { onSuccess: () => setSynonym("") });
          }}
        >
          <input
            className="adm-syn-input"
            aria-label={`Новый синоним для ${skill.name}`}
            placeholder="+ синоним"
            value={synonym}
            onChange={(e) => setSynonym(e.target.value)}
          />
        </form>
      </div>
    </article>
  );
}
