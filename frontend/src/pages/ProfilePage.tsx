import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Profile } from "../api/types";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/toastContext";
import { useAuth } from "../features/auth/useAuth";
import { useLogout } from "../features/auth/useAuthActions";
import {
  LEARNER_STATUS,
  useProfile,
  useSaveProfile,
  type LearnerStatus,
} from "../features/profile/useProfile";
import { errorText } from "../lib/errors";

/** Профиль: ответы онбординга можно поменять; аккаунт — почта, пароль, выход. */
export default function ProfilePage() {
  const profile = useProfile();
  return (
    <>
      <div className="page-head">
        <div>
          <Link className="btn link" to="/dashboard">
            ← Личный кабинет
          </Link>
          <h1 className="mt-10">Профиль и настройки</h1>
        </div>
      </div>
      <div className="grid2 align-start">
        {profile.isPending ? (
          <Skeleton height={420} />
        ) : profile.isError ? (
          <ErrorState error={profile.error} onRetry={profile.refetch} />
        ) : (
          <ProfileForm profile={profile.data} />
        )}
        <Account />
      </div>
    </>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const toast = useToast();
  const [status, setStatus] = useState<LearnerStatus | "">(profile.learner_status ?? "");
  const [course, setCourse] = useState(profile.course ? String(profile.course) : "");
  const [hours, setHours] = useState(profile.hours_per_week ? String(profile.hours_per_week) : "");
  const [deadline, setDeadline] = useState(profile.deadline ?? "");
  const [months, setMonths] = useState(
    profile.months_learning == null ? "" : String(profile.months_learning),
  );
  const [errors, setErrors] = useState<{ hours?: string; months?: string; form?: string }>({});

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const h = hours.trim();
    const m = months.trim();
    const next = {
      hours:
        h && (!/^\d+$/.test(h) || +h < 2 || +h > 40) ? "Часов в неделю: от 2 до 40" : undefined,
      months: m && (!/^\d+$/.test(m) || +m > 240) ? "Целое число от 0 до 240" : undefined,
    };
    setErrors(next);
    if (next.hours || next.months) return;
    save.mutate(
      {
        learner_status: status || null,
        course: status === "student" ? Number(course) || null : null,
        hours_per_week: h ? Number(h) : null,
        deadline: deadline || null,
        months_learning: m ? Number(m) : null,
      },
      {
        onSuccess: () => toast("Сохранено. Новые часы учтём при следующей сборке плана"),
        onError: (err) => setErrors({ form: errorText(err) }),
      },
    );
  };

  return (
    <form className="panel stack" onSubmit={onSubmit} noValidate>
      <h3>Ответы онбординга</h3>
      {!profile.onboarding_completed && (
        <p className="muted fs-14">
          Онбординг ещё не пройден —{" "}
          <Link to="/onboarding" className="link-accent">
            пройти по шагам
          </Link>
          .
        </p>
      )}
      <div className="field">
        <label htmlFor="pf-status">Статус</label>
        <select
          id="pf-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as LearnerStatus | "")}
        >
          <option value="">Не указан</option>
          {LEARNER_STATUS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {status === "student" && (
        <div className="field">
          <label htmlFor="pf-course">Курс</label>
          <select id="pf-course" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Не скажу</option>
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <option key={c} value={c}>
                {c} курс
              </option>
            ))}
          </select>
        </div>
      )}
      <Field2
        id="pf-hours"
        label="Часов в неделю"
        hint="От 2 до 40 — по ним считаем сроки плана"
        error={errors.hours}
        value={hours}
        onChange={setHours}
      />
      <div className="field">
        <label htmlFor="pf-deadline">Хочу найти работу к</label>
        <input
          id="pf-deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <Field2
        id="pf-months"
        label="Сколько месяцев уже учусь"
        error={errors.months}
        value={months}
        onChange={setMonths}
      />
      {errors.form && <Banner tone="error">{errors.form}</Banner>}
      <div>
        <Button type="submit" loading={save.isPending}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

function Field2(props: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const desc = props.error ? `${props.id}-err` : props.hint ? `${props.id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="text"
        inputMode="numeric"
        value={props.value}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={desc}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error ? (
        <span id={`${props.id}-err`} className="err">
          {props.error}
        </span>
      ) : (
        props.hint && (
          <span id={`${props.id}-hint`} className="hint">
            {props.hint}
          </span>
        )
      )}
    </div>
  );
}

function Account() {
  const { user } = useAuth();
  const logout = useLogout();
  const toast = useToast();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="stack gap-20">
      <div className="panel stack">
        <h3>Аккаунт</h3>
        <dl className="kv">
          <dt>Имя</dt>
          <dd>{user.name}</dd>
          <dt>Почта</dt>
          <dd className="row gap-6">
            {user.email}
            {user.email_verified ? (
              <span className="chip good">подтверждена</span>
            ) : (
              <span className="chip amber">не подтверждена</span>
            )}
          </dd>
        </dl>
      </div>
      <div className="panel stack">
        <h3>Пароль</h3>
        <p className="muted fs-14">
          Пришлём на почту ссылку, по которой можно задать новый пароль.
        </p>
        <Link className="btn ghost self-start" to="/reset">
          Сменить пароль
        </Link>
      </div>
      <div>
        <button
          type="button"
          className="btn ghost"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSettled: () => {
                toast("Вы вышли из аккаунта");
                navigate("/");
              },
            })
          }
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
