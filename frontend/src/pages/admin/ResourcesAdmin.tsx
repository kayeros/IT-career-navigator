import { useState, type FormEvent } from "react";
import { api, isApiError, unwrap } from "../../api/client";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import {
  RESOURCE_STATUS,
  RESOURCE_TYPE,
  useAdminAction,
  useAdminResources,
  type AdminResource,
  type AdminResourceInput,
  type ResourceStatus,
  orNull,
} from "../../features/admin/useAdmin";
import { isSafeUrl } from "../../lib/format";
import { AdminHead, QueryView, StatusChip, StatusTabs } from "./ui";

/** Материалы: пользователь видит только одобренные; предложенные ИИ команда проверяет вручную. */
export default function ResourcesAdmin() {
  const [status, setStatus] = useState<ResourceStatus | undefined>();
  const q = useAdminResources(status);
  const [editing, setEditing] = useState<AdminResource | "new" | null>(null);

  return (
    <>
      <AdminHead title="Материалы" hint="Курсы, видео и статьи, которые команда проверила.">
        <Button onClick={() => setEditing("new")}>Новый материал</Button>
      </AdminHead>
      {editing && (
        <ResourceForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <StatusTabs value={status} options={RESOURCE_STATUS} onChange={setStatus} />
      <QueryView q={q} empty="Материалов с таким статусом нет.">
        {(items) => (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Тип</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <ResourceRow key={r.id} r={r} onEdit={() => setEditing(r)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </>
  );
}

function ResourceRow({ r, onEdit }: { r: AdminResource; onEdit: () => void }) {
  const decide = useAdminAction(
    (status: ResourceStatus) =>
      unwrap(
        api.PATCH("/admin/resources/{id}", { params: { path: { id: r.id } }, body: { status } }),
      ),
    "Решение сохранено",
  );
  return (
    <tr>
      <td className="min-0">
        <b>{r.title}</b>
        <div className="fs-12 adm-url">
          {isSafeUrl(r.url) ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="link-accent">
              {r.url}
            </a>
          ) : (
            <span className="chip bad">небезопасная ссылка</span>
          )}
        </div>
        {r.review_comment && <div className="muted fs-12">{r.review_comment}</div>}
      </td>
      <td className="fs-13">
        {RESOURCE_TYPE[r.type]} · {r.language} · {r.is_free ? "бесплатно" : "платно"}
      </td>
      <td>
        <StatusChip status={r.status} label={RESOURCE_STATUS[r.status]} />
      </td>
      <td className="adm-actions">
        {r.status !== "approved" && (
          <Button size="sm" loading={decide.isPending} onClick={() => decide.mutate("approved")}>
            Одобрить
          </Button>
        )}
        {r.status !== "rejected" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={decide.isPending}
            onClick={() => decide.mutate("rejected")}
          >
            Отклонить
          </Button>
        )}
        <Button size="sm" variant="link" onClick={onEdit}>
          Изменить
        </Button>
      </td>
    </tr>
  );
}

function ResourceForm({
  initial,
  onClose,
}: {
  initial: AdminResource | null;
  onClose: () => void;
}) {
  const all = useAdminResources();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [type, setType] = useState<AdminResource["type"]>(initial?.type ?? "article");
  const [language, setLanguage] = useState(initial?.language ?? "ru");
  const [isFree, setIsFree] = useState(initial?.is_free ?? true);
  const [status, setStatus] = useState<ResourceStatus>(initial?.status ?? "approved");
  const [replacedBy, setReplacedBy] = useState(String(initial?.replaced_by_id ?? ""));
  const [comment, setComment] = useState(initial?.review_comment ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useAdminAction(
    (body: AdminResourceInput) =>
      initial
        ? unwrap(api.PATCH("/admin/resources/{id}", { params: { path: { id: initial.id } }, body }))
        : unwrap(api.POST("/admin/resources", { body })),
    initial ? "Материал сохранён" : "Материал добавлен",
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Укажите название";
    if (!/^https?:\/\/\S+$/.test(url.trim())) next.url = "Ссылка должна начинаться с https://";
    if (status === "replaced" && !replacedBy) next.replaced_by_id = "Выберите материал на замену";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(
      {
        title: title.trim(),
        url: url.trim(),
        type,
        language: language.trim() || "ru",
        is_free: isFree,
        status,
        replaced_by_id: status === "replaced" ? Number(replacedBy) : null,
        review_comment: orNull(comment),
      },
      {
        onSuccess: onClose,
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fields).length) setErrors(err.fields);
        },
      },
    );
  };

  return (
    <form className="panel stack mb-20 adm-form" onSubmit={onSubmit} noValidate>
      <h3>{initial ? "Материал" : "Новый материал"}</h3>
      <div className="adm-form-grid cols-2">
        <Field
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <Field
          label="Ссылка"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={errors.url}
        />
      </div>
      <div className="adm-form-grid">
        <div className="field">
          <label htmlFor="ar-type">Тип</label>
          <select
            id="ar-type"
            value={type}
            onChange={(e) => setType(e.target.value as AdminResource["type"])}
          >
            {Object.entries(RESOURCE_TYPE).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Field label="Язык" value={language} onChange={(e) => setLanguage(e.target.value)} />
        <div className="field">
          <label htmlFor="ar-status">Статус</label>
          <select
            id="ar-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ResourceStatus)}
          >
            {Object.entries(RESOURCE_STATUS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <label className="check self-end mb-10">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
          Бесплатный
        </label>
      </div>
      {status === "replaced" && (
        <div className="field">
          <label htmlFor="ar-repl">Заменён на</label>
          <select
            id="ar-repl"
            value={replacedBy}
            aria-invalid={errors.replaced_by_id ? true : undefined}
            onChange={(e) => setReplacedBy(e.target.value)}
          >
            <option value="">Выберите материал</option>
            {(all.data ?? [])
              .filter((r) => r.id !== initial?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
          </select>
          {errors.replaced_by_id && <span className="err">{errors.replaced_by_id}</span>}
        </div>
      )}
      <Field
        label="Комментарий проверки"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
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
