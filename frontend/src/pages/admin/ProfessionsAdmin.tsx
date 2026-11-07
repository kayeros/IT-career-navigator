import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, isApiError, unwrap } from "../../api/client";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  PROFESSION_STATUS,
  useAdminAction,
  useAdminProfessions,
  type AdminProfession,
  type AdminProfessionInput,
  orNull,
} from "../../features/admin/useAdmin";
import { AdminHead, QueryView, StatusChip } from "./ui";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function ProfessionsAdmin() {
  const q = useAdminProfessions();
  const [editing, setEditing] = useState<AdminProfession | "new" | null>(null);

  return (
    <>
      <AdminHead
        title="Профессии"
        hint="«Скрыта» — не видна в каталоге. Порядок показа — по полю «Порядок»."
      >
        <Button onClick={() => setEditing("new")}>Новая профессия</Button>
      </AdminHead>
      {editing && (
        <ProfessionForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          nextOrder={(q.data?.length ?? 0) + 1}
          onClose={() => setEditing(null)}
        />
      )}
      <QueryView q={q} empty="Профессий пока нет.">
        {(items) => (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Название</th>
                  <th>Адрес</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...items]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((p) => (
                    <tr key={p.id}>
                      <td className="mono muted">{p.sort_order}</td>
                      <td>
                        <b>{p.title}</b>
                      </td>
                      <td className="mono fs-13">{p.slug}</td>
                      <td>
                        <StatusChip status={p.status} label={PROFESSION_STATUS[p.status]} />
                      </td>
                      <td className="adm-actions">
                        <Link className="btn ghost sm" to={`/admin/professions/${p.id}`}>
                          Блоки и навыки
                        </Link>
                        <Button variant="link" size="sm" onClick={() => setEditing(p)}>
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

function ProfessionForm({
  initial,
  nextOrder,
  onClose,
}: {
  initial: AdminProfession | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [forWhom, setForWhom] = useState(initial?.for_whom ?? "");
  const [status, setStatus] = useState<AdminProfession["status"]>(initial?.status ?? "hidden");
  const [order, setOrder] = useState(String(initial?.sort_order ?? nextOrder));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useAdminAction(
    (body: AdminProfessionInput) =>
      initial
        ? unwrap(
            api.PATCH("/admin/professions/{id}", { params: { path: { id: initial.id } }, body }),
          )
        : unwrap(api.POST("/admin/professions", { body })),
    initial ? "Профессия сохранена" : "Профессия создана",
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!SLUG_RE.test(slug)) next.slug = "Латиница в нижнем регистре, цифры и дефисы: qa-manual";
    if (!title.trim()) next.title = "Укажите название";
    if (!/^\d+$/.test(order)) next.sort_order = "Целое число";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(
      {
        slug,
        title: title.trim(),
        description: orNull(description),
        for_whom: orNull(forWhom),
        status,
        sort_order: Number(order),
      },
      {
        onSuccess: onClose,
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fields).length) setErrors(err.fields);
          else if (isApiError(err) && err.status === 409)
            setErrors({ slug: "Такой адрес уже занят" });
        },
      },
    );
  };

  return (
    <form className="panel stack mb-20 adm-form" onSubmit={onSubmit} noValidate>
      <h3>{initial ? `Профессия «${initial.title}»` : "Новая профессия"}</h3>
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
          onChange={(e) => setSlug(e.target.value.trim())}
          error={errors.slug}
          hint={
            initial
              ? "Меняйте осторожно: старые ссылки перестанут работать"
              : "Например, python-dev"
          }
        />
        <div className="field">
          <label htmlFor="ap-status">Статус</label>
          <select
            id="ap-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminProfession["status"])}
          >
            {Object.entries(PROFESSION_STATUS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Порядок"
          inputMode="numeric"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          error={errors.sort_order}
        />
      </div>
      <div className="field">
        <label htmlFor="ap-desc">Описание</label>
        <textarea
          id="ap-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="ap-for">Кому подходит</label>
        <textarea id="ap-for" value={forWhom} onChange={(e) => setForWhom(e.target.value)} />
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
