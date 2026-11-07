import { Link } from "react-router-dom";

/** Профориентация — этап 2 (после рабочего MVP). Пока объясняем и ведём в каталог. */
export default function QuizPage() {
  return (
    <div className="panel stack narrow-panel">
      <span className="eyebrow">Профориентация</span>
      <h1>Тест скоро появится</h1>
      <p className="muted">
        Ответите на несколько вопросов о том, что вам нравится, и мы покажем три подходящие
        профессии с причинами. Пока выберите профессию в каталоге: у каждой есть описание и для кого
        она подходит.
      </p>
      <Link className="btn primary" to="/professions">
        Открыть каталог
      </Link>
    </div>
  );
}
