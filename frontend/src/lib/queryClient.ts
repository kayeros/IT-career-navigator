import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "../api/client";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Повторяем только сетевые сбои и 5xx, ответы 4xx — окончательные
        retry: (count, e) => count < 1 && (!isApiError(e) || e.status === 0 || e.status >= 500),
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
}
