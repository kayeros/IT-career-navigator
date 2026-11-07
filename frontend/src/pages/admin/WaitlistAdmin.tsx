import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAdminProfessions, useAdminWaitlist } from "../../features/admin/useAdmin";
import { formatDate } from "../../lib/format";
import { AdminHead, QueryView } from "./ui";

/** Заявки «Сообщить о запуске» по профессиям со статусом «скоро». */
export default function WaitlistAdmin() {
  const [slug, setSlug] = useState("");
  const q = useAdminWaitlist(slug || undefined);
  const professions = useAdminProfessions();
  const title = (s: string) => professions.data?.find((p) => p.slug === s)?.title ?? s;

  return (
    <>
      <AdminHead title="Заявки на запуск" hint="Кому написать, когда профессия станет доступна." />
      <div className="field mb-16 search-field">
        <label htmlFor="aw-prof">Профессия</label>
        <select id="aw-prof" value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">Все</option>
          {(professions.data ?? []).map((p) => (
            <option key={p.id} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      <QueryView q={q} empty="Заявок пока нет.">
        {(items) => (
          <>
            <p className="muted fs-14 mb-10">Всего: {items.length}</p>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Почта</th>
                    <th>Профессия</th>
                    <th>Дата</th>
                    <th>Аккаунт</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w.id}>
                      <td className="mono fs-13">{w.email}</td>
                      <td>{title(w.profession_slug)}</td>
                      <td className="fs-13">{formatDate(w.created_at)}</td>
                      <td className="fs-13">{w.user_id ? "есть" : "гость"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </QueryView>
    </>
  );
}

export function AdminIndex() {
  return <Navigate to="/admin/professions" replace />;
}
