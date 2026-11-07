import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";

export const professionKey = (slug: string) => ["profession", slug] as const;

export function useProfession(slug: string) {
  return useQuery({
    queryKey: professionKey(slug),
    queryFn: () => unwrap(api.GET("/professions/{slug}", { params: { path: { slug } } })),
  });
}
