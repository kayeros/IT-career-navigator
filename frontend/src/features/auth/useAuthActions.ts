import { useMutation } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import type { LoginRequest, RegisterRequest } from "../../api/types";
import { useAuth } from "./useAuth";

export function useLogin() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (body: LoginRequest) => unwrap(api.POST("/auth/login", { body })),
    onSuccess: (user) => setUser(user),
  });
}

export function useRegister() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (body: RegisterRequest) => unwrap(api.POST("/auth/register", { body })),
    onSuccess: (user) => setUser(user),
  });
}

export function useLogout() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/auth/logout")),
    // Выход отвечает 204 всегда; даже при сбое сети локально считаем пользователя вышедшим
    onSettled: () => setUser(null),
  });
}
