import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError, unwrap } from "../../api/client";

/** Текущий план; null — плана ещё не строили (404). */
export function usePlan(slug: string) {
  return useQuery({
    queryKey: ["plan", slug],
    queryFn: async () => {
      try {
        return await unwrap(api.GET("/professions/{slug}/plan", { params: { path: { slug } } }));
      } catch (e) {
        if (isApiError(e) && e.code === "not_found") return null;
        throw e;
      }
    },
  });
}

export function useBuildPlan(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { hours_per_week?: number; deadline?: string | null }) =>
      unwrap(api.POST("/professions/{slug}/plan", { params: { path: { slug } }, body })),
    onSuccess: (plan) => qc.setQueryData(["plan", slug], plan),
  });
}

export { useProfile } from "../profile/useProfile";
