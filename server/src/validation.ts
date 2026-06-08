import { z } from "zod";
import {
  BRAVERY_LEVELS,
  BLUEPRINT_DEPTHS,
  DECK_AUDIENCE_TYPES,
  DECK_DEPTHS,
  HANDOFF_REVIEW_MODES,
  EVALUATION_MODES,
  PROJECT_STAGES,
  PROJECT_STATUSES,
  PITCH_HANDOFF_TYPES,
  RESEARCH_DEPTHS,
  ROUTE_DEPTHS,
  SOURCE_ROLE_VALUES,
  SOURCE_STATUSES,
  SOURCE_TYPES
} from "@momentum-lab/shared";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const projectCreateSchema = z.object({
  project_name: z.string().trim().min(1, "Project name is required"),
  client_name: z.string().trim().optional(),
  category: z.string().trim().optional(),
  market: z.string().trim().optional(),
  audience: z.string().trim().optional(),
  objective: z.string().trim().optional(),
  known_constraints: z.string().trim().optional(),
  bravery_level: z.enum(BRAVERY_LEVELS).optional(),
  research_depth: z.enum(RESEARCH_DEPTHS).optional(),
  desired_output_type: z.string().trim().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  brief_notes: z.string().trim().optional()
});

export const projectPatchSchema = projectCreateSchema.partial().extend({
  current_stage: z.enum(PROJECT_STAGES).optional(),
  default_model_mode: z.string().trim().optional(),
  default_research_depth: z.string().trim().optional(),
  research_depth: z.enum(RESEARCH_DEPTHS).optional(),
  status: z.enum(PROJECT_STATUSES).optional()
});

export const messageCreateSchema = z.object({
  content: z.string().trim().min(1, "Message content is required")
});

export const settingsPatchSchema = z
  .object({
    default_model_mode: z.string().trim().min(1).optional(),
    default_research_depth: z.string().trim().min(1).optional(),
    default_bravery_level: z.enum(BRAVERY_LEVELS).optional(),
    monthly_usage_warning_level: z.number().int().min(1).max(100).optional(),
    active_model_providers: z.array(z.string().trim().min(1)).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one settings field is required"
  });

export const noteCreateSchema = z.object({
  content: z.string().trim().min(1, "Note content is required")
});

export const notePatchSchema = noteCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one note field is required" }
);

export const rejectedIdeaCreateSchema = z.object({
  title: z.string().trim().min(1, "Rejected idea title is required"),
  idea_text: z.string().trim().optional(),
  reason_for_rejection: z.string().trim().optional()
});

export const shortlistedIdeaCreateSchema = z.object({
  title: z.string().trim().min(1, "Shortlisted idea title is required"),
  idea_text: z.string().trim().optional(),
  why_shortlisted: z.string().trim().optional()
});

export const routeCreateSchema = z.object({
  route_title: z.string().trim().min(1, "Route title is required"),
  core_thought: z.string().trim().optional(),
  audience_tension: z.string().trim().optional(),
  brand_role: z.string().trim().optional(),
  execution_notes: z.string().trim().optional(),
  risks: z.string().trim().optional()
});

export const routePatchSchema = routeCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one route field is required" }
);

export const finalTruthUpsertSchema = z
  .object({
    developed_route_id: z.string().uuid().optional(),
    route_id: z.string().uuid().optional().nullable(),
    idea_card_id: z.string().uuid().optional().nullable(),
    evaluation_id: z.string().uuid().optional().nullable(),
    dossier_id: z.string().uuid().optional().nullable(),
    final_route_title: z.string().trim().min(1, "Final route title is required"),
    final_campaign_truth: z.string().trim().min(1, "Final campaign truth is required"),
    selection_rationale: z.string().trim().min(1, "Selection rationale is required"),
    rationale: z.string().trim().optional(),
    why_this_route_won: z.string().trim().optional(),
    rejected_or_deprioritised_notes: z.string().trim().optional(),
    proof_required: z.string().trim().optional(),
    risks_watchouts: z.string().trim().optional(),
    assumptions: z.string().trim().optional(),
    missing_context: z.string().trim().optional(),
    next_action: z.string().trim().min(1, "Next action is required"),
    user_notes: z.string().trim().optional()
  })
  .refine((value) => value.developed_route_id || value.route_id, {
    message: "Developed route is required"
  });

export const sourceInputSchema = z.object({
  title: z.string().trim().min(1, "Source title is required"),
  description: z.string().trim().optional(),
  source_role: z.enum(SOURCE_ROLE_VALUES).default("context"),
  source_type: z.enum(SOURCE_TYPES).default("text"),
  tags: z.array(z.string().trim().min(1)).default([]),
  source_status: z.enum(SOURCE_STATUSES).default("active"),
  source_url: z.string().trim().url().optional().or(z.literal("")),
  content_text: z.string().trim().optional()
});

export const sourcePatchSchema = sourceInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one source field is required" }
);

const emptyQueryValue = z.literal("").transform(() => undefined);

export const sourceSearchSchema = z.object({
  q: z.string().trim().min(1, "Search query is required").max(120),
  scope: z.enum(["project", "global", "combined"]).default("project"),
  mode: z.enum(["keyword", "semantic"]).default("keyword"),
  source_role: z.enum(SOURCE_ROLE_VALUES).optional().or(emptyQueryValue),
  source_type: z.enum(SOURCE_TYPES).optional().or(emptyQueryValue),
  limit: z.coerce.number().int().min(1).max(20).default(10)
});

export const embedSourceSchema = z.object({
  force: z.boolean().default(false)
});

export const contextPackSchema = z.object({
  query: z.string().trim().min(2, "Context query is required").max(300),
  retrieval_scope: z
    .enum(["project_only", "global_only", "project_plus_global"])
    .default("project_only"),
  retrieval_mode: z.enum(["keyword", "semantic"]).default("keyword"),
  source_roles: z.array(z.enum(SOURCE_ROLE_VALUES)).default([...SOURCE_ROLE_VALUES]),
  source_types: z.array(z.enum(SOURCE_TYPES)).default([...SOURCE_TYPES]),
  max_chunks_per_section: z.number().int().min(1).max(10).default(5),
  max_total_chunks: z.number().int().min(1).max(25).default(25),
  max_characters: z.number().int().min(1000).max(20000).default(12000)
});

export const dossierGenerateSchema = contextPackSchema.extend({
  title: z.string().trim().min(1).max(120).optional()
});

export const ideationGenerateSchema = contextPackSchema.extend({
  dossier_id: z.string().uuid().optional(),
  bravery_level: z.enum(BRAVERY_LEVELS).default("Sharp"),
  idea_count: z.number().int().min(3).max(15).default(8),
  user_instruction: z.string().trim().max(800).optional()
});

export const ideaStatusUpdateSchema = z.object({
  reason: z.string().trim().max(500).optional()
});

export const ideaEvaluationGenerateSchema = contextPackSchema.extend({
  idea_card_ids: z.array(z.string().uuid()).min(1, "Select at least one idea").max(10),
  dossier_id: z.string().uuid().optional(),
  evaluation_mode: z.enum(EVALUATION_MODES).default("Strategic review")
});

export const routeDevelopSchema = contextPackSchema.extend({
  idea_card_id: z.string().uuid(),
  dossier_id: z.string().uuid().optional(),
  evaluation_id: z.string().uuid().optional(),
  route_depth: z.enum(ROUTE_DEPTHS).default("Standard route"),
  user_instruction: z.string().trim().max(800).optional()
});

export const routeRevisionNoteSchema = z.object({
  note: z.string().trim().min(1, "Revision note is required").max(1000)
});

export const campaignBlueprintGenerateSchema = contextPackSchema.extend({
  final_selection_id: z.string().uuid().optional(),
  developed_route_id: z.string().uuid().optional(),
  idea_card_id: z.string().uuid().optional(),
  evaluation_id: z.string().uuid().optional(),
  dossier_id: z.string().uuid().optional(),
  blueprint_depth: z.enum(BLUEPRINT_DEPTHS).default("Standard blueprint"),
  user_instruction: z.string().trim().max(800).optional()
});

export const campaignBlueprintRevisionNoteSchema = z.object({
  note: z.string().trim().min(1, "Revision note is required").max(1000)
});

export const pitchDeckHandoffGenerateSchema = contextPackSchema.extend({
  campaign_blueprint_id: z.string().uuid(),
  final_selection_id: z.string().uuid().optional(),
  developed_route_id: z.string().uuid().optional(),
  handoff_type: z.enum(PITCH_HANDOFF_TYPES).default("PPT design team handoff"),
  deck_depth: z.enum(DECK_DEPTHS).default("Standard deck"),
  audience_type: z.enum(DECK_AUDIENCE_TYPES).default("Client leadership"),
  user_instruction: z.string().trim().max(800).optional()
});

export const pitchDeckHandoffRevisionNoteSchema = z.object({
  note: z.string().trim().min(1, "Revision note is required").max(1000)
});

export const pitchDeckHandoffReviewGenerateSchema = contextPackSchema.extend({
  pitch_deck_handoff_id: z.string().uuid(),
  review_mode: z.enum(HANDOFF_REVIEW_MODES).default("Standard client-readiness review"),
  user_instruction: z.string().trim().max(800).optional()
});

export const pitchDeckHandoffReviewNoteSchema = z.object({
  note: z.string().trim().min(1, "Review note is required").max(1000)
});
