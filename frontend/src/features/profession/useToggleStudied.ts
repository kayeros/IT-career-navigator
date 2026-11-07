import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import type { ProfessionDetail } from "../../api/types";
import { professionKey } from "./useProfession";

type Vars = { topicId: number; studied: boolean };

/** Ставит отметке «Изучено» новое значение во всех блоках карточки (тема может стоять в нескольких). */
function applyStudied(detail: ProfessionDetail, { topicId, studied }: Vars): ProfessionDetail {
  let wasStudied: boolean | null = null;
  const blocks = detail.blocks.map((block) => ({
    ...block,
    topics: block.topics.map((t) => {
      if (t.id !== topicId) return t;
      wasStudied ??= t.studied;
      return { ...t, studied };
    }),
  }));
  let progress = detail.progress;
  if (progress && wasStudied !== null && wasStudied !== studied) {
    progress = { ...progress, studied: progress.studied + (studied ? 1 : -1) };
  }
  return { ...detail, blocks, progress };
}

/**
 * Отметка «Изучено»: интерфейс обновляется сразу, при ошибке отметка откатывается.
 * После ответа перезапрашиваем карточки (отметка общая для всех профессий) и % соответствия.
 */
export function useToggleStudied(slug: string) {
  const queryClient = useQueryClient();
  const key = professionKey(slug);

  return useMutation({
    mutationFn: ({ topicId, studied }: Vars) => {
      const params = { params: { path: { id: topicId } } };
      return studied
        ? unwrap(api.PUT("/topics/{id}/progress", params))
        : unwrap(api.DELETE("/topics/{id}/progress", params));
    },
    onMutate: (vars) => {
      // Без await: галочка должна поменяться в том же кадре, что и клик
      void queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProfessionDetail>(key);
      if (previous) queryClient.setQueryData(key, applyStudied(previous, vars));
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profession"] });
      queryClient.invalidateQueries({ queryKey: ["match"] });
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export { applyStudied };
