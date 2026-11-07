import { Link } from "react-router-dom";
import type { ProfessionSummary } from "../../api/types";
import { professionLook } from "../../lib/professionIcons";
import type { CSSProperties } from "react";

const colors = (slug: string) => {
  const look = professionLook(slug);
  return { "--c1": look.c1, "--c2": look.c2 } as CSSProperties;
};

/** Блок «Кем хотите стать?» с главной прототипа. */
export function ProfessionPicker({ professions }: { professions: ProfessionSummary[] }) {
  const shown = professions.slice(0, 5);
  const rest = professions.slice(5);
  const quizPreview = professions.filter((p) => p.status === "available").slice(0, 3);

  return (
    <section className="section">
      <h2>Кем хотите стать?</h2>
      <div className="p3-wrap">
        <div className="p3-card p3-pick p3y">
          <div className="p3-h">
            <span className="p3-n">Уже знаю</span>
            <h3>Выберите профессию</h3>
            <span className="muted p3-p">Откроем карту навыков и требования работодателей.</span>
          </div>
          <div className="pk-grid">
            {shown.map((p) => {
              const look = professionLook(p.slug);
              const body = (
                <>
                  <span className="pk-i">{look.icon}</span>
                  <span className="pk-tt">
                    <b>{p.title}</b>
                    <span className="mono">
                      {p.status === "available" ? `${p.topics_count} тем` : "скоро"}
                    </span>
                  </span>
                </>
              );
              return p.status === "available" ? (
                <Link
                  key={p.slug}
                  to={`/professions/${p.slug}`}
                  className="pk-t"
                  style={colors(p.slug)}
                >
                  {body}
                </Link>
              ) : (
                <span
                  key={p.slug}
                  className="pk-t"
                  style={{ ...colors(p.slug), opacity: 0.6 }}
                  aria-disabled="true"
                >
                  {body}
                </span>
              );
            })}
            <Link to="/professions" className="pk-t pk-more">
              <span className="pk-stack">
                {rest.slice(0, 4).map((p) => (
                  <span key={p.slug} className="pk-i" style={colors(p.slug)}>
                    {professionLook(p.slug).icon}
                  </span>
                ))}
              </span>
              <span className="pk-tt">
                <b>{rest.length ? `Ещё ${rest.length}` : "Все профессии"}</b>
                <span className="mono">каталог →</span>
              </span>
            </Link>
          </div>
        </div>
        <Link to="/quiz" className="p3-card p3-quiz p3y">
          <span className="p3-h">
            <span className="p3-n">Пока не знаю</span>
            <h3>Пройдите тест</h3>
            <span className="muted p3-p">Несколько вопросов, и подберём профессию под вас.</span>
          </span>
          <span className="p3-b">
            <span className="qz-prev">
              {quizPreview.map((p, i) => {
                const m = [92, 84, 76][i];
                return (
                  <span
                    key={p.slug}
                    className="qz-row"
                    style={{ "--w": `${m}%`, "--d": `${i * 0.15}s` } as CSSProperties}
                  >
                    <span className="pk-i sm" style={colors(p.slug)}>
                      {professionLook(p.slug).icon}
                    </span>
                    <span className="qz-n">{p.title}</span>
                    <span className="qz-bar">
                      <i />
                    </span>
                    <span className="mono qz-p">{m}%</span>
                  </span>
                );
              })}
            </span>
            <span className="qz-foot">
              <span className="qz-btn">Пройти тест →</span>
              <span className="mono muted">≈ 2 минуты</span>
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}
