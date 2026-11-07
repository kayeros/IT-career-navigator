import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../api/client";
import type { AnswerInput, Assessment, AssessmentSkill } from "../../api/types";

/** Начать или продолжить оценку: POST вернёт незавершённую (200) или новую (201). */
export function useStartAssessment(slug: string) {
  return useQuery({
    queryKey: ["assessment", slug],
    queryFn: () =>
      unwrap(api.POST("/professions/{slug}/assessments", { params: { path: { slug } } })),
    // Не перезапрашиваем сами: состояние оценки ведём локально по ответам PUT
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
}

export function useAnswer(slug: string, assessmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, body }: { skillId: number; body: AnswerInput }) =>
      unwrap(
        api.PUT("/assessments/{id}/answers/{skill_id}", {
          params: { path: { id: assessmentId, skill_id: skillId } },
          body,
        }),
      ),
    onSuccess: (saved: AssessmentSkill) => {
      qc.setQueryData<Assessment>(["assessment", slug], (a) =>
        a ? { ...a, skills: a.skills.map((s) => (s.skill_id === saved.skill_id ? saved : s)) } : a,
      );
    },
  });
}

export function useCompleteAssessment(slug: string, assessmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST("/assessments/{id}/complete", { params: { path: { id: assessmentId } } })),
    onSuccess: (report) => {
      qc.setQueryData(["report", slug], report);
      // Уровни навыков поменялись: % соответствия и план устарели
      qc.invalidateQueries({ queryKey: ["match"] });
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}
