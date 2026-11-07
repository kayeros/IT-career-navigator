import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";

export function useMatch(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ["match", slug],
    queryFn: () => unwrap(api.GET("/professions/{slug}/match", { params: { path: { slug } } })),
    // Гостю не запрашиваем: будет 401
    enabled,
  });
}
