import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";

export function useProfessions() {
  return useQuery({
    queryKey: ["professions"],
    queryFn: () => unwrap(api.GET("/professions")).then((r) => r.items),
  });
}
