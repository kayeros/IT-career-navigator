import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Profile, ProfileInput } from "../api/types";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/toastContext";
import { useProfessions } from "../features/catalog/useProfessions";
import {
  LEARNER_STATUS,
  useProfile,
  useSaveProfile,
  type LearnerStatus,
} from "../features/profile/useProfile";
import { errorText } from "../lib/errors";
import { lastProfession } from "../lib/lastProfession";

const STEPS = ["Статус", "Профессия", "Время", "Пара вопросов"];
const UNKNOWN = "unknown";

/** Онбординг: 4 шага, каждый «Далее» сохраняет свои ответы — можно уйти и вернуться. */
export default function OnboardingPage() {
  const profile = useProfile();
  if (profile.isPending)
    return (
      <div className="quiz">
        <Skeleton height={36} width="50%" />
        <Skeleton height={240} />
      </div>
    );
  if (profile.isError) return <ErrorState error={profile.error} onRetry={profile.refetch} />;
  return <Wizard profile={profile.data} />;
}

function Wizard({ profile }: { profile: Profile }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveProfile();
  const professions = useProfessions();
  const available = (professions.data ?? []).filter((p) => p.status === "available");

  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<LearnerStatus | null>(profile.learner_status ?? null);
  const [course, setCourse] = useState(profile.course ? String(profile.course) : "");
  const [prof, setProf] = useState(params.get("profession") ?? lastProfession() ?? "");
  const [hours, setHours] = useState(profile.hours_per_week ?? 10);
  const [deadline, setDeadline] = useState(profile.deadline ?? "");
  const [months, setMonths] = useState(
    profile.months_learning == null ? "" : String(profile.months_learning),
  );
  const [unneeded, setUnneeded] = useState<boolean | null>(profile.learned_unneeded);
  const [error, setError] = useState<string | null>(null);

  const last = step === STEPS.length - 1;
  const today = new Date().toISOString().slice(0, 10);

  const stepBody = (): ProfileInput | string => {
    if (step === 0) {
      if (!status) return "Выберите вариант";
      return {
        learner_status: status,
        course: status === "student" ? Number(course) || null : null,
      };
    }
    if (step === 1) return prof ? {} : "Выберите профессию или «Не знаю»";
    if (step === 2) {
      if (deadline && deadline < today) return "Дата уже прошла — выберите дату в будущем";
      return { hours_per_week: hours, deadline: deadline || null };
    }
    const m = months.trim();
    if (m && (!/^\d+$/.test(m) || Number(m) > 240)) return "Месяцев: целое число от 0 до 240";
    return {
      months_learning: m ? Number(m) : null,
      learned_unneeded: unneeded,
      complete_onboarding: true,
    };
  };

  const finish = () => {
    toast("Готово! Ответы можно поменять в профиле");
    navigate(prof === UNKNOWN || !prof ? "/quiz" : `/professions/${prof}`, { replace: true });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body = stepBody();
    if (typeof body === "string") return setError(body);
    setError(null);
    const next = () => (last ? finish() : setStep((s) => s + 1));
    if (!Object.keys(body).length) return next();
    save.mutate(body, { onSuccess: next, onError: (err) => setError(errorText(err)) });
  };

  return (
    <div className="quiz">
      <div className="page-head">
        <div>
          <span className="eyebrow">Онбординг</span>
          <h1 className="mt-8">Расскажите о себе</h1>
          <p className="muted">
            Ответы нужны, чтобы рассчитать персональный план. Их можно изменить в профиле.
          </p>
        </div>
      </div>
      <div className="onb-steps" aria-label={`Шаг ${step + 1} из ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={i < step ? "done" : i === step ? "on" : ""}>
            <i>{i + 1}</i>
            {s}
          </span>
        ))}
      </div>
      <form className="panel stack gap-22" onSubmit={onSubmit} noValidate>
        <p className="muted fs-13 mono">
          Шаг {step + 1} из {STEPS.length}
        </p>

        {step === 0 && (
          <>
            <fieldset className="field fieldset-plain">
              <legend>Кто вы сейчас?</legend>
              <div className="opts">
                {LEARNER_STATUS.map(([v, t]) => (
                  <label key={v} className="opt">
                    <input
                      type="radio"
                      name="status"
                      value={v}
                      checked={status === v}
                      onChange={() => setStatus(v)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            {status === "student" && (
              <div className="field">
                <label htmlFor="onb-course">Курс</label>
                <select id="onb-course" value={course} onChange={(e) => setCourse(e.target.value)}>
                  <option value="">Не скажу</option>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <option key={c} value={c}>
                      {c} курс
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <fieldset className="field fieldset-plain">
            <legend>Какую профессию хотите освоить?</legend>
            {professions.isPending ? (
              <Skeleton height={120} />
            ) : (
              <div className="opts">
                {available.map((p) => (
                  <label key={p.slug} className="opt">
                    <input
                      type="radio"
                      name="prof"
                      value={p.slug}
                      checked={prof === p.slug}
                      onChange={() => setProf(p.slug)}
                    />
                    {p.title}
                  </label>
                ))}
                <label className="opt">
                  <input
                    type="radio"
                    name="prof"
                    value={UNKNOWN}
                    checked={prof === UNKNOWN}
                    onChange={() => setProf(UNKNOWN)}
                  />
                  Не знаю, помогите выбрать
                </label>
              </div>
            )}
            <span className="hint">
              Остальные профессии скоро появятся — посмотреть их можно в{" "}
              <Link to="/professions" className="link-accent">
                каталоге
              </Link>
              .
            </span>
          </fieldset>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <label htmlFor="onb-hours">
                Сколько часов в неделю готовы уделять: <b className="mono">{hours} ч</b>
              </label>
              <input
                id="onb-hours"
                className="accent-check"
                type="range"
                min={2}
                max={40}
                value={hours}
                aria-valuetext={`${hours} часов в неделю`}
                onChange={(e) => setHours(Number(e.target.value))}
              />
              <span className="hint">От 2 до 40 часов. По ним посчитаем сроки плана.</span>
            </div>
            <div className="field">
              <label htmlFor="onb-deadline">
                Когда хотите найти работу <span className="muted fw-400">— необязательно</span>
              </label>
              <input
                id="onb-deadline"
                type="date"
                min={today}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="field">
              <label htmlFor="onb-months">
                Сколько месяцев вы уже учитесь?{" "}
                <span className="muted fw-400">— необязательно</span>
              </label>
              <input
                id="onb-months"
                type="number"
                inputMode="numeric"
                min={0}
                max={240}
                placeholder="Например, 6"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <fieldset className="field fieldset-plain">
              <legend>
                Было ли, что учили лишнее — то, что потом не пригодилось?{" "}
                <span className="muted fw-400">— необязательно</span>
              </legend>
              <div className="opts opts-row">
                {(
                  [
                    [true, "Да, было"],
                    [false, "Нет"],
                  ] as const
                ).map(([v, t]) => (
                  <label key={t} className="opt">
                    <input
                      type="radio"
                      name="unneeded"
                      checked={unneeded === v}
                      onChange={() => setUnneeded(v)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {error && <Banner tone="error">{error}</Banner>}

        <div className="row between">
          <div className="row">
            {step > 0 && (
              <button type="button" className="btn ghost" onClick={() => setStep((s) => s - 1)}>
                ← Назад
              </button>
            )}
            <Button type="submit" loading={save.isPending}>
              {last ? "Готово" : "Далее"}
            </Button>
          </div>
          <Link to="/professions" className="btn link">
            Пропустить
          </Link>
        </div>
      </form>
    </div>
  );
}
