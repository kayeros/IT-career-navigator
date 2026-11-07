import { useEffect, useRef } from "react";
import heroArt from "./heroArt.html?raw";

/**
 * Иллюстрация с главной из прототипа: статичная SVG-разметка из нашего файла (не данные API),
 * поэтому её можно вставить как HTML. Лёгкий параллакс за курсором — как в прототипе.
 */
export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const a = ref.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const inside =
        e.clientX > r.left - 200 &&
        e.clientX < r.right + 200 &&
        e.clientY > r.top - 200 &&
        e.clientY < r.bottom + 200;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      const mx = inside ? clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) : 0;
      const my = inside ? clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) : 0;
      a.style.setProperty("--mx", mx.toFixed(3));
      a.style.setProperty("--my", my.toFixed(3));
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      className="o-art iso-art"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: heroArt }}
    />
  );
}
