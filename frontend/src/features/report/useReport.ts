import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";

export function useReport(slug: string) {
  return useQuery({
    queryKey: ["report", slug],
    queryFn: () => unwrap(api.GET("/professions/{slug}/report", { params: { path: { slug } } })),
  });
}
