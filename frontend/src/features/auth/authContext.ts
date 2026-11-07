import { createContext } from "react";
import type { User } from "../../api/types";

export type AuthState = {
  /** undefined — ещё проверяем сессию, null — гость */
  user: User | null | undefined;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthState | null>(null);
