import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { useProfessions } from "../features/catalog/useProfessions";
import { FeedbackForm } from "../features/home/FeedbackForm";
import { HeroArt } from "../features/home/HeroArt";
import { ProfessionPicker } from "../features/home/ProfessionPicker";
import { plural } from "../lib/format";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: professions = [] } = useProfessions();
  const available = professions.filter((p) => p.status === "available");
  // Шаги «Как это работает» ведут на экраны первой открытой профессии
  const demo = available[0]?.slug;
  const demoPath = (tail: string) => (demo ? `/professions/${demo}${tail}` : "/professions");

  const steps = [
    [
      "Выберите профессию",
      "Из каталога или по итогам теста на профориентацию, если ещё не определились.",
      "/professions",
      "Каталог",
    ],
    [
      "Оцените свои навыки",
      "Около 10 минут вопросов по темам, которые встречаются в вакансиях.",
      demoPath("/assess"),
      "Пример оценки",
    ],
    [
      "Посмотрите отчёт",
      "Процент соответствия вакансиям и навыки, которых не хватает.",
      demoPath("/report"),
      "Пример отчёта",
    ],
    [
      "Идите по плану",
      "Порядок тем, часы на каждую и срок с учётом вашего свободного времени.",
      demoPath("/plan"),
      "Пример плана",
    ],
  ];

  return (
    <>
      <section className="o-hero">
        <div className="o-copy">
          <span className="eyebrow">Для студентов, выпускников и тех, кто меняет профессию</span>
          <h1 className="mt-14">Узнайте, чего вам не хватает до первой работы в IT</h1>
          <p className="lead">
            Выберите профессию, пройдите оценку навыков и сравните себя с требованиями реальных
            вакансий. Затем получите план: что учить, в каком порядке и сколько это займёт.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn primary lg"
              onClick={() => navigate(user ? "/professions" : "/register?next=%2Fprofessions")}
            >
              Начать бесплатно
            </button>
            <Link to="/professions" className="btn ghost lg">
              Каталог профессий
            </Link>
          </div>
          <dl className="o-facts">
            <div>
              <dt>{professions.length || "—"}</dt>
              <dd>
                {plural(professions.length, ["профессия", "профессии", "профессий"])} в каталоге
              </dd>
            </div>
            <div>
              <dt>{available.length || "—"}</dt>
              <dd>уже {plural(available.length, ["открыта", "открыты", "открыто"])}</dd>
            </div>
            <div>
              <dt>≈10&nbsp;мин</dt>
              <dd>на оценку навыков</dd>
            </div>
          </dl>
        </div>
        <HeroArt />
      </section>

      {professions.length > 0 && <ProfessionPicker professions={professions} />}

      <section className="section">
        <h2>Как это работает</h2>
        <p className="muted mt-8">
          Четыре шага от выбора профессии до плана. Нажмите на шаг, чтобы открыть пример экрана.
        </p>
        <div className="o-how">
          {steps.map(([title, text, to, label], i) => (
            <Link key={title} to={to} className="o-how-step">
              <span className="o-how-n">Шаг {i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="o-how-prev">{HOW_PREVIEW[i]}</div>
              <span className="o-how-go">{label} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section o-contact">
        <div className="o-contact-info">
          <div className="stack gap-8">
            <h2>Остались вопросы?</h2>
            <p className="muted">Напишите нам, ответим на почту в течение рабочего дня.</p>
          </div>
          <dl className="o-contacts">
            <div>
              <dt>Почта</dt>
              <dd>info@navigator-it.ru</dd>
            </div>
            <div>
              <dt>Telegram</dt>
              <dd>@navigator_it</dd>
            </div>
            <div>
              <dt>Часы работы</dt>
              <dd>Пн–Пт, 10:00–19:00 (МСК)</dd>
            </div>
          </dl>
          <div className="o-social">
            <span className="muted fs-14">Мы в соцсетях:</span>
            <span className="chip">ВКонтакте</span>
            <span className="chip">Telegram-канал</span>
          </div>
        </div>
        <FeedbackForm />
      </section>
    </>
  );
}

const HOW_PREVIEW = [
  <div className="row gap-6" key="0">
    <span className="chip accent">QA</span>
    <span className="chip">Python</span>
    <span className="chip">Java</span>
  </div>,
  <div className="stack gap-8" key="1">
    <span className="fs-13">Какой код ответа означает «не найдено»?</span>
    <div className="progress m-0">
      <i className="on" />
      <i className="on" />
      <i />
      <i />
    </div>
  </div>,
  <div className="row gap-10 nowrap" key="2">
    <b className="mono fs-20">46%</b>
    <div className="grow">
      <div className="meter">
        <i className="w-78" />
      </div>
    </div>
  </div>,
  <div className="stack gap-4 fs-13" key="3">
    <div className="row between">
      <span>Тест-дизайн</span>
      <span className="mono muted">16 ч</span>
    </div>
    <div className="row between">
      <span>SQL</span>
      <span className="mono muted">14 ч</span>
    </div>
  </div>,
];
