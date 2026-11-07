import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { hasError: boolean };

/** Глобальная защита от «белого экрана». */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ошибка интерфейса:", error.message, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="wrap">
        <div className="stack nf-wrap" role="alert">
          <h1>Что-то пошло не так</h1>
          <p className="muted">Страница не смогла открыться. Попробуйте обновить её.</p>
          <button className="btn primary" type="button" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>
      </main>
    );
  }
}
