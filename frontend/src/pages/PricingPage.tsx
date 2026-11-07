import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";

/**
 * Подписка: что бесплатно и что входит в подписку.
 * Оплаты пока нет (этап 3, сервис не выбран) — на пилоте подписку выдают промокодом.
 */
export default function PricingPage() {
  const { user } = useAuth();
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Подписка</span>
          <h1 className="mt-8">Персональный план до первой работы</h1>
          <p className="muted">
            Базовые инструменты бесплатны. Подписка нужна, чтобы получить полный разбор и план под
            ваше время и сроки.
          </p>
        </div>
      </div>
      <div className="grid2 tiers">
        <div className="panel tier free">
          <div className="stack gap-6">
            <h3>Бесплатно</h3>
            <span className="price">0 ₽</span>
          </div>
          <ul>
            <li>Каталог профессий</li>
            <li>Общая карта тем профессии</li>
            <li>Отметки «Изучено» после входа</li>
            <li>Профориентация</li>
            <li>Оценка навыков и краткий отчёт: процент и главные пробелы</li>
            <li className="no">Полный отчёт о разрыве</li>
            <li className="no">Персональный план от ИИ</li>
          </ul>
          {user ? (
            <button type="button" className="btn ghost" disabled>
              Ваш текущий тариф
            </button>
          ) : (
            <Link className="btn ghost" to="/register">
              Зарегистрироваться
            </Link>
          )}
        </div>
        <div className="panel tier pro">
          <div className="stack gap-6">
            <div className="row">
              <h3>Подписка</h3>
              <span className="chip accent">скоро</span>
            </div>
            <span className="price">
              250 ₽ <span className="muted fs-16 ff-body fw-500">/ мес</span>
            </span>
          </div>
          <ul>
            <li>Всё из бесплатного тарифа</li>
            <li>Полный отчёт о разрыве: все навыки и пробелы</li>
            <li>Персональный план от ИИ: порядок тем, часы, итоговый срок</li>
            <li>Сводка по рынку труда</li>
            <li>Пересчёт плана после повторной оценки</li>
          </ul>
          <button type="button" className="btn primary" disabled>
            Оплата скоро появится
          </button>
          <p className="muted fs-13">
            Пока подписку на пилоте выдаём по промокоду. Условия — в{" "}
            <Link to="/terms">пользовательском соглашении</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
