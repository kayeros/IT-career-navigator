import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, isApiError, setUnauthorizedHandler, unwrap } from "../../api/client";
import type { User } from "../../api/types";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null | undefined>(undefined);
  const queryClient = useQueryClient();

  const setUser = useMemo(
    () => (next: User | null) => {
      setUserState(next);
      // Карточка профессии зависит от того, кто вошёл: перезапрашиваем
      queryClient.invalidateQueries({ queryKey: ["profession"] });
      if (next === null) queryClient.removeQueries({ queryKey: ["match"] });
    },
    [queryClient],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => setUserState(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    unwrap(api.GET("/me"))
      .then((me) => !cancelled && setUserState(me))
      .catch((e: unknown) => {
        // 401 — гость; при сбое сети тоже показываем как гостя, чтобы сайт работал
        if (!cancelled) setUserState(null);
        if (isApiError(e) && e.code !== "unauthorized") console.error("GET /me:", e.code);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, setUser }), [user, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
