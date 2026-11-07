import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isApiError } from "../api/client";
import type { Assessment, AssessmentSkill } from "../api/types";
import { Banner } from "../components/Banner";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/toastContext";
import {
  useAnswer,
  useCompleteAssessment,
  useStartAssessment,
} from "../features/assessment/useAssessment";
import { useProfession } from "../features/profession/useProfession";
import { errorText } from "../lib/errors";

type Level = "none" | "basic" | "confident";
const LEVELS: [Level, string, string][] = [
  ["none", "Не знаю", "Не сталкивался(ась) или только слышал(а)"],
  ["basic", "Базово", "Делал(а) учебные задачи, разбираюсь с подсказками"],
  ["confident", "Уверенно", "Применял(а) на практике. Проверим одним вопросом"],
];

/** Оценка навыков: навыки по одному, «не знаю / базово / уверенно», для «уверенно» — проверочный вопрос. */
export default function AssessPage() {
  const { slug = "" } = useParams();
  const prof = useProfession(slug);
  const start = useStartAssessment(slug);

  if (prof.isPending || start.isPending)
    return (
      <div className="quiz stack" aria-busy="true">
        <Skeleton height={14} width="60%" />
        <Skeleton height={260} />
      </div>
    );
  if (prof.error) return <ErrorState error={prof.error} onRetry={() => prof.refetch()} />;
  if (start.error) {
    if (isApiError(start.error) && start.error.code === "too_soon")
      return (
        <div className="panel stack narrow-panel">
          <h2>Оценку можно пройти заново позже</h2>
          <p className="muted">
            {start.error.message || "Повторная оценка — не чаще раза в 7 дней."}
          </p>
          <div className="row">
            <Link className="btn primary" to={`/professions/${slug}/report`}>
              Открыть отчёт
            </Link>
            <Link className="btn ghost" to={`/professions/${slug}`}>
              К карте профессии
            </Link>
          </div>
        </div>
      );
    return <ErrorState error={start.error} onRetry={() => start.refetch()} />;
  }
  if (start.data.skills.length === 0)
    return (
      <div className="panel stack narrow-panel">
        <h2>Оценка пока недоступна</h2>
        <p className="muted">Для этой профессии ещё не настроены ключевые навыки.</p>
        <Link className="btn ghost" to={`/professions/${slug}`}>
          К карте профессии
        </Link>
      </div>
    );

  return <AssessFlow slug={slug} title={prof.data.title} assessment={start.data} />;
}

function firstOpen(a: Assessment) {
  const i = a.skills.findIndex((s) => !s.answer);
  return i === -1 ? a.skills.length - 1 : i;
}

function AssessFlow({
  slug,
  title,
  assessment,
}: {
  slug: string;
  title: string;
  assessment: Assessment;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(() => firstOpen(assessment));
  const answer = useAnswer(slug, assessment.id);
  const complete = useCompleteAssessment(slug, assessment.id);
  const [error, setError] = useState<string | null>(null);

  const total = assessment.skills.length;
  const skill = assessment.skills[step];
  const last = step === total - 1;
  const answered = assessment.skills.filter((s) => s.answer).length;
  const busy = answer.isPending || complete.isPending;

  const finish = () =>
    complete.mutate(undefined, {
      onSuccess: () => {
        toast("Оценка завершена");
        navigate(`/professions/${slug}/report`);
      },
      onError: (e) => setError(errorText(e)),
    });

  const submit = (level: Level, checkOption: number | null) => {
    setError(null);
    const prev = skill.answer;
    const unchanged =
      prev && prev.self_level === level && (level !== "confident" || prev.check_passed !== null);
    const goNext = () => (last ? finish() : setStep(step + 1));
    if (unchanged) return goNext();
    answer.mutate(
      {
        skillId: skill.skill_id,
        body:
          checkOption === null
            ? { self_level: level }
            : { self_level: level, check_option: checkOption },
      },
      {
        onSuccess: goNext,
        onError: (e) => {
          if (isApiError(e) && e.code === "completed") navigate(`/professions/${slug}/report`);
          else setError(errorText(e));
        },
      },
    );
  };

  return (
    <div className="quiz">
      <div className="row between">
        <Link to={`/professions/${slug}`} className="btn link fs-13">
          ← К карте профессии
        </Link>
        <span className="muted fs-13">Ответы сохраняются — можно продолжить позже</span>
      </div>
      <span className="eyebrow mt-12 block">
        Оценка навыков · {title} · навык {step + 1} из {total}
      </span>
      <div
        className="progress mt-12"
        role="progressbar"
        aria-label="Отвечено навыков"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
      >
        {assessment.skills.map((s, i) => (
          <i key={s.skill_id} className={s.answer ? "on" : i === step ? "cur" : ""} />
        ))}
      </div>
      {/* key: при смене навыка форма начинается с его сохранённого ответа */}
      <SkillStep
        key={skill.skill_id}
        skill={skill}
        first={step === 0}
        last={last}
        busy={busy}
        error={error}
        onBack={() => (setError(null), setStep(step - 1))}
        onSubmit={submit}
      />
    </div>
  );
}

function SkillStep({
  skill,
  first,
  last,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  skill: AssessmentSkill;
  first: boolean;
  last: boolean;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (level: Level, checkOption: number | null) => void;
}) {
  const [level, setLevel] = useState<Level | null>(skill.answer?.self_level ?? null);
  const [option, setOption] = useState<number | null>(null);
  const q = skill.question;
  const checked = skill.answer?.self_level === "confident" && skill.answer.check_passed !== null;
  const needCheck = level === "confident" && q !== null && !checked;
  const ready = level !== null && (!needCheck || option !== null);

  return (
    <form
      className="panel stack gap-18"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && level) onSubmit(level, level === "confident" && q ? (option ?? 0) : null);
      }}
    >
      <fieldset className="stack gap-12">
        <legend className="assess-q">
          Как вы владеете навыком <b>«{skill.name}»</b>?
        </legend>
        <div className="opts">
          {LEVELS.map(([v, t, hint]) => (
            <label key={v} className="opt">
              <input
                type="radio"
                name="level"
                value={v}
                checked={level === v}
                onChange={() => setLevel(v)}
              />
              <span className="stack gap-2">
                <b className="fs-15">{t}</b>
                <span className="muted fs-13">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {level === "confident" && q && checked && (
        <span className="chip good self-start">Проверочный вопрос уже засчитан</span>
      )}
      {needCheck && q && (
        <fieldset className="check-q stack gap-12">
          <legend className="eyebrow">Проверочный вопрос</legend>
          <p className="fs-15">{q.text}</p>
          <div className="opts">
            {q.options.map((o, i) => (
              <label key={i} className="opt">
                <input
                  type="radio"
                  name="check"
                  checked={option === i}
                  onChange={() => setOption(i)}
                />
                <span className="fs-14">{o}</span>
              </label>
            ))}
          </div>
          <span className="muted fs-13">
            Ответить можно один раз. Если ошибётесь, навык засчитаем как «базово».
          </span>
        </fieldset>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <div className="row between">
        <Button variant="ghost" disabled={first || busy} onClick={onBack}>
          Назад
        </Button>
        <Button type="submit" disabled={!ready} loading={busy}>
          {last ? "Завершить и посмотреть отчёт" : "Дальше"}
        </Button>
      </div>
    </form>
  );
}
