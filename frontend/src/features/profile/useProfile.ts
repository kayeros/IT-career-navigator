import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import type { ProfileInput } from "../../api/types";

/** Профиль и ответы онбординга (поля null, пока не заполнены). */
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => unwrap(api.GET("/me/profile")),
    enabled,
  });
}

/** Сохраняет только переданные поля; ответ сервера кладём в кэш. */
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileInput) => unwrap(api.PUT("/me/profile", { body })),
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });
}

export const LEARNER_STATUS = [
  ["student", "Студент"],
  ["graduate", "Выпускник"],
  ["switcher", "Переквалификация — работаю в другой сфере"],
  ["other", "Другое"],
] as const;

export type LearnerStatus = (typeof LEARNER_STATUS)[number][0];

export const statusLabel = (s: string | null | undefined) =>
  LEARNER_STATUS.find(([v]) => v === s)?.[1].split(" — ")[0] ?? "не указан";
