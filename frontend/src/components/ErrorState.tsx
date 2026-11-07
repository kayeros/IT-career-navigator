import { errorText } from "../lib/errors";
import { Button } from "./Button";

/** Ошибка загрузки данных с кнопкой «Повторить». */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="panel stack items-start" role="alert">
      <p>{errorText(error)}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
