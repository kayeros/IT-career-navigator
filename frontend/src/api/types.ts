// Короткие имена для типов из сгенерированной схемы. Свои интерфейсы для данных API не пишем.
import type { components } from "./schema";

export type Schemas = components["schemas"];

export type User = Schemas["User"];
export type RegisterRequest = Schemas["RegisterRequest"];
export type LoginRequest = Schemas["LoginRequest"];
export type ProfessionSummary = Schemas["ProfessionSummary"];
export type ProfessionDetail = Schemas["ProfessionDetail"];
export type Block = Schemas["Block"];
export type Topic = Schemas["Topic"];
export type Resource = Schemas["Resource"];
export type Match = Schemas["Match"];
export type MissingSkill = Schemas["MissingSkill"];
export type Profile = Schemas["Profile"];
export type ProfileInput = Schemas["ProfileInput"];
export type Assessment = Schemas["Assessment"];
export type AssessmentSkill = Schemas["AssessmentSkill"];
export type AnswerInput = Schemas["AnswerInput"];
export type Report = Schemas["Report"];
export type Plan = Schemas["Plan"];
export type PlanItem = Schemas["PlanItem"];
