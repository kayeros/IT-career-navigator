import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import type { Schemas } from "../../api/types";
import { useToast } from "../../components/toastContext";
import { errorText } from "../../lib/errors";

// В спецификации required у AdminProfession стоит внутри allOf, и генератор его теряет — уточняем тип здесь
export type AdminProfession = Schemas["AdminProfession"] &
  Required<Pick<Schemas["AdminProfessionInput"], "slug" | "title" | "status" | "sort_order">>;
export type AdminProfessionInput = Schemas["AdminProfessionInput"];
export type AdminBlock = Schemas["AdminBlock"];
export type AdminProfessionSkill = Schemas["AdminProfessionSkill"];
export type AdminTopic = Schemas["AdminTopic"];
export type AdminTopicInput = Schemas["AdminTopicInput"];
export type AdminSkill = Schemas["AdminSkill"];
export type AdminSkillInput = Schemas["AdminSkillInput"];
export type AdminResource = Schemas["AdminResource"];
export type AdminResourceInput = Schemas["AdminResourceInput"];
export type UnknownTerm = Schemas["UnknownTerm"];
export type WaitlistEntry = Schemas["WaitlistEntry"];

export type SkillStatus = AdminSkill["status"];
export type ResourceStatus = AdminResource["status"];
export type TermStatus = UnknownTerm["status"];

/** Ключи кэша админки: всё под ["admin"], правка контента сбрасывает и публичные карточки. */
export const adminKey = {
  professions: ["admin", "professions"] as const,
  blocks: (id: number) => ["admin", "blocks", id] as const,
  profSkills: (id: number) => ["admin", "prof-skills", id] as const,
  topics: (q: string) => ["admin", "topics", q] as const,
  skills: (status?: SkillStatus) => ["admin", "skills", status ?? "all"] as const,
  resources: (status?: ResourceStatus) => ["admin", "resources", status ?? "all"] as const,
  terms: (status?: TermStatus) => ["admin", "terms", status ?? "all"] as const,
  waitlist: (slug?: string) => ["admin", "waitlist", slug ?? "all"] as const,
};

export const useAdminProfessions = () =>
  useQuery({
    queryKey: adminKey.professions,
    queryFn: async () => (await unwrap(api.GET("/admin/professions"))) as AdminProfession[],
  });

export const useAdminBlocks = (id: number) =>
  useQuery({
    queryKey: adminKey.blocks(id),
    queryFn: () => unwrap(api.GET("/admin/professions/{id}/blocks", { params: { path: { id } } })),
  });

export const useAdminProfessionSkills = (id: number) =>
  useQuery({
    queryKey: adminKey.profSkills(id),
    queryFn: () => unwrap(api.GET("/admin/professions/{id}/skills", { params: { path: { id } } })),
  });

export const useAdminTopics = (q = "") =>
  useQuery({
    queryKey: adminKey.topics(q),
    queryFn: () => unwrap(api.GET("/admin/topics", { params: { query: q ? { q } : {} } })),
    placeholderData: (prev) => prev,
  });

export const useAdminSkills = (status?: SkillStatus) =>
  useQuery({
    queryKey: adminKey.skills(status),
    queryFn: () =>
      unwrap(api.GET("/admin/skills", { params: { query: status ? { status } : {} } })),
  });

export const useAdminResources = (status?: ResourceStatus) =>
  useQuery({
    queryKey: adminKey.resources(status),
    queryFn: () =>
      unwrap(api.GET("/admin/resources", { params: { query: status ? { status } : {} } })),
  });

export const useAdminTerms = (status?: TermStatus) =>
  useQuery({
    queryKey: adminKey.terms(status),
    queryFn: () =>
      unwrap(api.GET("/admin/unknown-terms", { params: { query: status ? { status } : {} } })),
  });

export const useAdminWaitlist = (slug?: string) =>
  useQuery({
    queryKey: adminKey.waitlist(slug),
    queryFn: () =>
      unwrap(
        api.GET("/admin/waitlist", { params: { query: slug ? { profession_slug: slug } : {} } }),
      ),
  });

/**
 * Мутация админки: после успеха — тост и сброс кэша админки и публичного контента,
 * ошибка — тост с понятным текстом (формы дополнительно показывают ошибки полей сами).
 */
export function useAdminAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string,
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast(success);
      void qc.invalidateQueries({ queryKey: ["admin"] });
      void qc.invalidateQueries({ queryKey: ["professions"] });
      void qc.invalidateQueries({ queryKey: ["profession"] });
    },
    onError: (e) => toast(errorText(e)),
  });
}

export const SKILL_STATUS: Record<SkillStatus, string> = {
  new: "новый",
  in_review: "на проверке",
  verified: "проверен",
};
export const RESOURCE_STATUS: Record<ResourceStatus, string> = {
  ai_suggested: "предложен ИИ",
  approved: "одобрен",
  rejected: "отклонён",
  replaced: "заменён",
};
export const TERM_STATUS: Record<TermStatus, string> = {
  new: "не разобран",
  became_skill: "стал навыком",
  became_synonym: "стал синонимом",
  ignored: "не навык",
};
export const PROFESSION_STATUS: Record<AdminProfession["status"], string> = {
  available: "доступна",
  soon: "скоро",
  hidden: "скрыта",
};
export const RESOURCE_TYPE: Record<NonNullable<AdminResource["type"]>, string> = {
  article: "статья",
  video: "видео",
  course: "курс",
  docs: "документация",
  practice: "практика",
};

/** Текст из поля ввода: пустая строка → null. */
export const orNull = (v: string) => (v.trim() ? v.trim() : null);
