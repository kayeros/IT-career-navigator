import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer>
      <div className="wrap" id="foot">
        <div className="f-grid">
          <div className="f-brand">
            <Logo />
            <p className="muted">
              Навигатор для тех, кто входит в IT: выберите профессию, узнайте свой уровень и учитесь
              по плану.
            </p>
          </div>
          <div className="f-col f-info">
            <span className="eyebrow">Сервис</span>
            <div className="f-links">
              <Link to="/professions">Каталог профессий</Link>
              <Link to="/quiz">Тест на профориентацию</Link>
            </div>
          </div>
          <div className="f-col f-info">
            <span className="eyebrow">Информация</span>
            <div className="f-links">
              <Link to="/privacy">Политика конфиденциальности</Link>
            </div>
          </div>
          <div className="f-col">
            <span className="eyebrow">Контакты</span>
            <span>info@navigator-it.ru</span>
            <span>Telegram: @navigator_it</span>
            <span className="muted">Пн–Пт, 10:00–19:00 (МСК)</span>
          </div>
        </div>
        <div className="f-bottom">
          <span>© {new Date().getFullYear()} Карьерный навигатор IT</span>
          <span>Данные о вакансиях обновляются раз в месяц</span>
        </div>
      </div>
    </footer>
  );
}
