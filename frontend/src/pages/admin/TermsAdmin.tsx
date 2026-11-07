import { useState } from "react";
import { api, unwrap } from "../../api/client";
import { Button } from "../../components/Button";
import {
  TERM_STATUS,
  useAdminAction,
  useAdminSkills,
  useAdminTerms,
  type AdminSkill,
  type TermStatus,
  type UnknownTerm,
} from "../../features/admin/useAdmin";
import { formatDate } from "../../lib/format";
import { AdminHead, QueryView, StatusChip, StatusTabs } from "./ui";

/** Частые термины из вакансий, которых нет в справочнике: разбирает команда. */
export default function TermsAdmin() {
  const [status, setStatus] = useState<TermStatus | undefined>("new");
  const q = useAdminTerms(status);
  const skills = useAdminSkills();

  return (
    <>
      <AdminHead
        title="Неизвестные термины"
        hint="Их копит сервис аналитики. «Навык» создаёт новый навык со статусом «новый»; «Синоним» — добавляет термин к навыку."
      />
      <StatusTabs value={status} options={TERM_STATUS} onChange={setStatus} />
      <QueryView q={q} empty="Нет терминов с таким статусом.">
        {(items) => (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Термин</th>
                  <th>Вакансий</th>
                  <th>Последний раз</th>
                  <th>Статус</th>
                  <th>Решение</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <TermRow key={t.id} term={t} skills={skills.data ?? []} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </>
  );
}

function TermRow({ term, skills }: { term: UnknownTerm; skills: AdminSkill[] }) {
  const [skillId, setSkillId] = useState("");
  const resolve = useAdminAction(
    (body: { status: TermStatus; skill_id?: number }) =>
      unwrap(api.PATCH("/admin/unknown-terms/{id}", { params: { path: { id: term.id } }, body })),
    "Решение сохранено",
  );
  const linked = skills.find((s) => s.id === term.skill_id);

  return (
    <tr>
      <td>
        <b className="mono">{term.term}</b>
      </td>
      <td className="mono">{term.occurrences}</td>
      <td className="fs-13">{formatDate(term.last_seen_at)}</td>
      <td>
        <StatusChip status={term.status} label={TERM_STATUS[term.status]} />
        {linked && <div className="muted fs-12">→ {linked.name}</div>}
      </td>
      <td>
        {term.status === "new" ? (
          <div className="row gap-6 adm-term-actions">
            <Button
              size="sm"
              loading={resolve.isPending}
              onClick={() => resolve.mutate({ status: "became_skill" })}
            >
              Навык
            </Button>
            <select
              aria-label={`Навык для синонима «${term.term}»`}
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
            >
              <option value="">Синоним к…</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              disabled={!skillId || resolve.isPending}
              onClick={() =>
                resolve.mutate({ status: "became_synonym", skill_id: Number(skillId) })
              }
            >
              Синоним
            </Button>
            <Button
              size="sm"
              variant="link"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ status: "ignored" })}
            >
              Не навык
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="link"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ status: "new" })}
          >
            Вернуть в разбор
          </Button>
        )}
      </td>
    </tr>
  );
}
