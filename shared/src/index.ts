export const PROJECT_STAGES = [
  "Intake",
  "Research",
  "Thought starters",
  "Shortlist",
  "Route development",
  "Final campaign truth"
] as const;

export const PROJECT_STATUSES = [
  "Draft",
  "Research",
  "Ideation",
  "Shortlisted",
  "Developed",
  "Finalised",
  "Archived"
] as const;

export const RESEARCH_DEPTHS = ["Light", "Standard", "Deep"] as const;

export const BRAVERY_LEVELS = [
  "Safe",
  "Sharp",
  "Bold",
  "Wild",
  "Chaos first"
] as const;

export const EVALUATION_MODES = [
  "Quick screen",
  "Strategic review",
  "Creative red-team",
  "Commercial feasibility check",
  "Anti-generic audit"
] as const;

export const EVALUATION_RECOMMENDED_ACTIONS = [
  "Reject",
  "Revise",
  "Shortlist",
  "Develop",
  "Park for later"
] as const;

export const DEVELOPMENT_READINESS_LEVELS = ["Low", "Medium", "High"] as const;

export const ROUTE_DEPTHS = ["Light route", "Standard route", "Deep route"] as const;
export const BLUEPRINT_DEPTHS = [
  "Lean blueprint",
  "Standard blueprint",
  "Detailed blueprint"
] as const;
export const PITCH_HANDOFF_TYPES = [
  "Internal pitch structure",
  "Client pitch structure",
  "Founder review structure",
  "Creative team handoff",
  "PPT design team handoff"
] as const;
export const DECK_DEPTHS = ["Short deck", "Standard deck", "Detailed deck"] as const;
export const DECK_AUDIENCE_TYPES = [
  "Internal team",
  "Client leadership",
  "Marketing team",
  "B2B boardroom",
  "Employer branding team",
  "Creative review",
  "General"
] as const;
export const HANDOFF_REVIEW_MODES = [
  "Quick readiness scan",
  "Standard client-readiness review",
  "Deep red-team review",
  "Founder review"
] as const;
export const CLIENT_READINESS_STATUSES = [
  "Ready for PPT build",
  "Needs proof before PPT build",
  "Needs client input before PPT build",
  "Needs visual assets before PPT build",
  "Needs strategic revision",
  "Internal review only",
  "Do not move ahead yet"
] as const;
export const SLIDE_REVIEW_RECOMMENDATIONS = [
  "Keep as is",
  "Keep with minor edits",
  "Needs proof",
  "Needs client input",
  "Needs stronger visual direction",
  "Merge with another slide",
  "Move earlier",
  "Move later",
  "Convert to internal-only",
  "Do not present yet",
  "Remove from deck structure"
] as const;

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;

export const MESSAGE_TYPES = [
  "normal_chat",
  "research_dossier",
  "thought_starters",
  "shortlist",
  "route_development",
  "final_route",
  "critique",
  "export"
] as const;

export const DOSSIER_SECTION_KEYS = [
  "client_need",
  "category_repetition",
  "audience_feeling",
  "market_forces",
  "moments_or_events",
  "borrowable_mechanics",
  "proof_or_product_truth",
  "category_boredom",
  "disruption_opportunity",
  "assumptions",
  "missing_context",
  "clarifications"
] as const;

export const SOURCE_ROLES = [
  "Context source",
  "Strategy source",
  "Inspiration source",
  "Evaluation source",
  "Mandatory rule source"
] as const;

export const SOURCE_ROLE_VALUES = [
  "context",
  "strategy",
  "inspiration",
  "evaluation",
  "mandatory_rule"
] as const;

export const SOURCE_TYPES = [
  "text",
  "markdown",
  "pdf",
  "docx",
  "image",
  "url",
  "note",
  "transcript",
  "other"
] as const;

export const SOURCE_STATUSES = ["active", "inactive", "archived", "replaced"] as const;
export const PROCESSING_STATUSES = [
  "not_processed",
  "queued",
  "processing",
  "processed",
  "failed",
  "unsupported"
] as const;
export const EMBEDDING_STATUSES = [
  "not_embedded",
  "queued",
  "embedding",
  "embedded",
  "failed",
  "skipped"
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number];
export type BraveryLevel = (typeof BRAVERY_LEVELS)[number];
export type EvaluationMode = (typeof EVALUATION_MODES)[number];
export type EvaluationRecommendedAction = (typeof EVALUATION_RECOMMENDED_ACTIONS)[number];
export type DevelopmentReadiness = (typeof DEVELOPMENT_READINESS_LEVELS)[number];
export type RouteDepth = (typeof ROUTE_DEPTHS)[number];
export type BlueprintDepth = (typeof BLUEPRINT_DEPTHS)[number];
export type PitchHandoffType = (typeof PITCH_HANDOFF_TYPES)[number];
export type DeckDepth = (typeof DECK_DEPTHS)[number];
export type DeckAudienceType = (typeof DECK_AUDIENCE_TYPES)[number];
export type HandoffReviewMode = (typeof HANDOFF_REVIEW_MODES)[number];
export type ClientReadinessStatus = (typeof CLIENT_READINESS_STATUSES)[number];
export type SlideReviewRecommendation = (typeof SLIDE_REVIEW_RECOMMENDATIONS)[number];
export type MessageRole = (typeof MESSAGE_ROLES)[number];
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type DossierSectionKey = (typeof DOSSIER_SECTION_KEYS)[number];
export type SourceRoleValue = (typeof SOURCE_ROLE_VALUES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type SourceStatus = (typeof SOURCE_STATUSES)[number];
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];
export type EmbeddingStatus = (typeof EMBEDDING_STATUSES)[number];

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  project_name: string;
  client_name: string | null;
  category: string | null;
  market: string | null;
  audience: string | null;
  objective: string | null;
  known_constraints: string | null;
  bravery_level: BraveryLevel | null;
  default_model_mode: string | null;
  default_research_depth: string | null;
  research_depth: ResearchDepth;
  desired_output_type: string | null;
  status: ProjectStatus;
  brief_notes: string | null;
  current_stage: ProjectStage;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  project_name: string;
  client_name?: string;
  category?: string;
  market?: string;
  audience?: string;
  objective?: string;
  known_constraints?: string;
  bravery_level?: BraveryLevel;
  research_depth?: ResearchDepth;
  desired_output_type?: string;
  status?: ProjectStatus;
  brief_notes?: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  role: MessageRole;
  content: string;
  message_type: MessageType;
  model_used: string | null;
  created_at: string;
}

export interface GlobalSource {
  id: string;
  title: string;
  file_name: string | null;
  file_type: string | null;
  storage_path: string | null;
  source_role: string;
  source_status: string;
  source_type: SourceType;
  tags: string[];
  source_url: string | null;
  content_text: string | null;
  file_size: number | null;
  mime_type: string | null;
  storage_bucket: string | null;
  uploaded_at: string | null;
  description: string | null;
  notes: string | null;
  uploaded_by: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  processed_at: string | null;
  extracted_text_available: boolean;
  extracted_character_count: number;
  detected_source_type: string | null;
  embedding_status: EmbeddingStatus;
  embedding_error: string | null;
  embedded_chunk_count: number;
  failed_embedding_count: number;
  last_embedded_at: string | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSource {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  source_role: SourceRoleValue;
  source_type: SourceType;
  tags: string[];
  source_status: SourceStatus;
  source_url: string | null;
  content_text: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  mime_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  processed_at: string | null;
  extracted_text_available: boolean;
  extracted_character_count: number;
  detected_source_type: string | null;
  embedding_status: EmbeddingStatus;
  embedding_error: string | null;
  embedded_chunk_count: number;
  failed_embedding_count: number;
  last_embedded_at: string | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceContentSummary {
  id: string;
  source_id: string;
  source_scope: "global" | "project";
  project_id: string | null;
  extraction_method: string;
  character_count: number;
  word_count: number;
  extracted_text_preview: string;
  created_at: string;
  updated_at: string;
}

export interface SourceChunk {
  id: string;
  source_id: string;
  source_scope: "global" | "project";
  project_id: string | null;
  chunk_index: number;
  chunk_text: string;
  character_count: number;
  token_estimate: number;
  created_at: string;
}

export type SourceSearchScope = "project" | "global" | "combined";
export type ContextPackScope = "project_only" | "global_only" | "project_plus_global";
export type RetrievalMode = "keyword" | "semantic";

export interface SourceSearchResult {
  chunk_id: string;
  source_id: string;
  source_scope: "global" | "project";
  project_id: string | null;
  source_title: string;
  source_role: SourceRoleValue;
  source_type: SourceType;
  source_status: SourceStatus;
  chunk_index: number;
  snippet: string;
  matched_text: string;
  character_count: number;
  token_estimate: number;
  similarity?: number;
  created_at: string;
}

export interface SourceSearchInput {
  q: string;
  scope?: SourceSearchScope;
  mode?: "keyword" | "semantic";
  source_role?: SourceRoleValue;
  source_type?: SourceType;
  limit?: number;
}

export interface ContextPackChunk {
  chunk_id: string;
  source_id: string;
  source_scope: "global" | "project";
  project_id: string | null;
  source_title: string;
  source_role: SourceRoleValue;
  source_type: SourceType;
  chunk_index: number;
  snippet: string;
  matched_text: string;
  similarity?: number;
}

export interface ContextPackSection {
  key:
    | "mandatory_rules"
    | "project_context"
    | "strategy_intelligence"
    | "inspiration_material"
    | "evaluation_material"
    | "general_context";
  title: string;
  role: SourceRoleValue | "project_context";
  chunks: ContextPackChunk[];
}

export interface ContextPackAssumptions {
  retrieval_scope: ContextPackScope;
  retrieval_mode: RetrievalMode;
  included_source_roles: SourceRoleValue[];
  included_source_types: SourceType[];
  max_chunks_per_section: number;
  max_total_chunks: number;
  max_characters: number;
  snippet_length: number;
}

export interface ContextPack {
  project_id: string | null;
  user_id: string;
  query: string;
  retrieval_scope: ContextPackScope;
  retrieval_mode: RetrievalMode;
  created_at: string;
  sections: ContextPackSection[];
  assumptions: ContextPackAssumptions;
  missing_or_unavailable_context: string[];
  total_chunks: number;
  total_characters: number;
  mandatory_rules_found: boolean;
}

export interface ContextPackInput {
  query: string;
  retrieval_scope?: ContextPackScope;
  retrieval_mode?: RetrievalMode;
  source_roles?: SourceRoleValue[];
  source_types?: SourceType[];
  max_chunks_per_section?: number;
  max_total_chunks?: number;
  max_characters?: number;
}

export interface DossierSection {
  key: DossierSectionKey;
  title: string;
  content: string[];
}

export interface DossierGroundingSummary {
  context_pack_total_chunks: number;
  mandatory_rule_chunks: number;
  source_titles: string[];
  source_roles: SourceRoleValue[];
  source_scopes: Array<"project" | "global">;
}

export interface ProjectDossier {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  task_query: string;
  retrieval_scope: ContextPackScope;
  retrieval_mode: RetrievalMode;
  selected_roles: SourceRoleValue[];
  selected_source_types: SourceType[];
  dossier_content: {
    sections: DossierSection[];
  };
  grounding_metadata: DossierGroundingSummary;
  assumptions: string[];
  missing_context: string[];
  model_provider: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface DossierGenerateInput extends ContextPackInput {
  title?: string;
}

export type IdeaCardStatus = "generated" | "rejected" | "shortlisted" | "developed" | "archived";

export interface ProjectIdeationRun {
  id: string;
  project_id: string;
  created_by: string;
  dossier_id: string | null;
  task_query: string;
  bravery_level: BraveryLevel;
  retrieval_scope: ContextPackScope;
  retrieval_mode: RetrievalMode;
  selected_roles: SourceRoleValue[];
  selected_source_types: SourceType[];
  model_provider: string;
  model_name: string;
  idea_count: number;
  created_at: string;
}

export interface ProjectIdeaCard {
  id: string;
  project_id: string;
  created_by: string;
  dossier_id: string | null;
  generation_run_id: string | null;
  title: string;
  one_line_idea: string;
  core_collision: string;
  audience_tension: string;
  product_truth: string;
  execution_format: string;
  why_it_may_work: string;
  non_generic_reason: string;
  risk_watchout: string;
  source_grounding_note: string;
  assumptions: string[];
  bravery_level: BraveryLevel;
  retrieval_scope: ContextPackScope;
  retrieval_mode: RetrievalMode;
  selected_roles: SourceRoleValue[];
  selected_source_types: SourceType[];
  status: IdeaCardStatus;
  rejection_reason: string | null;
  shortlist_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeationGenerateInput extends ContextPackInput {
  dossier_id?: string;
  bravery_level?: BraveryLevel;
  idea_count?: number;
  user_instruction?: string;
}

export const EVALUATION_DIMENSION_KEYS = [
  "strategic_fit",
  "originality",
  "brand_product_truth",
  "source_grounding",
  "audience_tension",
  "execution_potential",
  "feasibility",
  "genericness_risk",
  "bravery_fit",
  "development_potential"
] as const;

export type EvaluationDimensionKey = (typeof EVALUATION_DIMENSION_KEYS)[number];

export type EvaluationScores = Record<EvaluationDimensionKey, number>;

export interface ProjectIdeaEvaluation {
  id: string;
  project_id: string;
  idea_card_id: string;
  created_by: string;
  evaluation_mode: EvaluationMode;
  dossier_id: string | null;
  retrieval_scope: ContextPackScope;
  retrieval_mode: RetrievalMode;
  selected_roles: SourceRoleValue[];
  selected_source_types: SourceType[];
  scores_json: EvaluationScores;
  overall_sharpness_score: number;
  genericness_risk_score: number;
  development_readiness: DevelopmentReadiness;
  overall_verdict: string;
  strongest_aspect: string;
  weakest_aspect: string;
  source_grounding_assessment: string;
  unsupported_claims: string[];
  feasibility_risks: string[];
  sharpness_suggestions: string[];
  recommended_action: EvaluationRecommendedAction;
  model_provider: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaEvaluationGenerateInput extends ContextPackInput {
  idea_card_ids: string[];
  dossier_id?: string;
  evaluation_mode?: EvaluationMode;
}

export interface SourceInput {
  title: string;
  description?: string;
  source_role?: SourceRoleValue;
  source_type?: SourceType;
  tags?: string[];
  source_status?: SourceStatus;
  source_url?: string;
  content_text?: string;
}

export interface Settings {
  id: string;
  default_model_mode: string;
  default_research_depth: string;
  default_bravery_level: BraveryLevel;
  monthly_usage_warning_level: number;
  active_model_providers: string[];
  created_at: string;
  updated_at: string;
}

export interface SettingsPatchInput {
  default_model_mode?: string;
  default_research_depth?: string;
  default_bravery_level?: BraveryLevel;
  monthly_usage_warning_level?: number;
  active_model_providers?: string[];
}

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface RejectedIdea {
  id: string;
  project_id: string;
  title: string;
  idea_text: string | null;
  reason_for_rejection: string | null;
  created_at: string;
}

export interface ShortlistedIdea {
  id: string;
  project_id: string;
  title: string;
  idea_text: string | null;
  why_shortlisted: string | null;
  created_at: string;
}

export interface DevelopedRoute {
  id: string;
  project_id: string;
  idea_card_id: string | null;
  dossier_id: string | null;
  evaluation_id: string | null;
  created_by: string | null;
  route_depth: RouteDepth;
  route_name: string | null;
  route_title: string | null;
  route_summary: string | null;
  core_campaign_thought: string | null;
  core_thought: string | null;
  audience_tension: string | null;
  category_pressure: string | null;
  brand_product_truth: string | null;
  brand_role: string | null;
  non_generic_reason: string | null;
  campaign_mechanics: string[];
  execution_system: Record<string, string>;
  sample_touchpoints: string[];
  execution_notes: string | null;
  proof_needed: string | null;
  risks: string | null;
  risk_notes: string | null;
  route_status: string;
  feasibility_notes: string | null;
  source_grounding_summary: string | null;
  assumptions: string[];
  missing_context: string[];
  next_refinement_questions: string[];
  model_provider: string | null;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteRevisionNote {
  id: string;
  project_id: string;
  route_id: string;
  created_by: string;
  note: string;
  created_at: string;
}

export interface RouteDevelopInput extends ContextPackInput {
  idea_card_id: string;
  dossier_id?: string;
  evaluation_id?: string;
  route_depth?: RouteDepth;
  user_instruction?: string;
}

export interface FinalCampaignTruth {
  id: string;
  project_id: string;
  route_id: string | null;
  developed_route_id: string | null;
  idea_card_id: string | null;
  evaluation_id: string | null;
  dossier_id: string | null;
  selected_by: string | null;
  final_route_title: string | null;
  final_campaign_truth: string | null;
  rationale: string | null;
  selection_rationale: string | null;
  why_this_route_won: string | null;
  rejected_or_deprioritised_notes: string | null;
  proof_required: string | null;
  risks_watchouts: string | null;
  assumptions: string | null;
  missing_context: string | null;
  next_action: string | null;
  is_active: boolean;
  status: "active" | "superseded" | "inactive";
  superseded_by: string | null;
  selected_at: string;
  created_at: string;
  updated_at: string;
}

export interface FinalRouteSelectionInput {
  developed_route_id: string;
  idea_card_id?: string | null;
  evaluation_id?: string | null;
  dossier_id?: string | null;
  final_route_title: string;
  final_campaign_truth: string;
  selection_rationale: string;
  why_this_route_won?: string;
  rejected_or_deprioritised_notes?: string;
  proof_required?: string;
  risks_watchouts?: string;
  assumptions?: string;
  missing_context?: string;
  next_action: string;
  user_notes?: string;
}

export interface CampaignBlueprint {
  id: string;
  project_id: string;
  final_selection_id: string;
  developed_route_id: string;
  idea_card_id: string | null;
  evaluation_id: string | null;
  dossier_id: string | null;
  created_by: string | null;
  blueprint_depth: BlueprintDepth;
  blueprint_title: string;
  selected_campaign_truth: string;
  route_summary: string;
  strategic_problem: string;
  audience_tension: string;
  category_pressure: string;
  brand_product_truth: string;
  brand_role: string;
  campaign_platform_statement: string;
  campaign_promise: string;
  message_hierarchy: Record<string, unknown>;
  core_narrative_arc: string;
  execution_pillars: Array<Record<string, unknown>>;
  campaign_mechanics: string[];
  touchpoint_system: Array<Record<string, unknown>>;
  proof_stack_required: string[];
  assets_formats_to_explore: string[];
  rollout_logic: string;
  risks_watchouts: string[];
  feasibility_notes: string;
  assumptions: string[];
  missing_context: string[];
  open_questions: string[];
  next_recommended_action: string;
  model_provider: string | null;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignBlueprintRevisionNote {
  id: string;
  project_id: string;
  blueprint_id: string;
  created_by: string;
  note: string;
  created_at: string;
}

export interface CampaignBlueprintGenerateInput extends ContextPackInput {
  final_selection_id?: string;
  developed_route_id?: string;
  idea_card_id?: string;
  evaluation_id?: string;
  dossier_id?: string;
  blueprint_depth?: BlueprintDepth;
  user_instruction?: string;
}

export interface PitchDeckHandoff {
  id: string;
  project_id: string;
  campaign_blueprint_id: string;
  final_selection_id: string | null;
  developed_route_id: string | null;
  idea_card_id: string | null;
  evaluation_id: string | null;
  dossier_id: string | null;
  created_by: string | null;
  handoff_type: PitchHandoffType;
  deck_depth: DeckDepth;
  audience_type: DeckAudienceType;
  deck_purpose: Record<string, unknown>;
  core_campaign_truth: Record<string, unknown>;
  narrative_arc: Record<string, unknown>;
  slide_structure: Array<Record<string, unknown>>;
  section_breaks: string[];
  visual_design_notes: Record<string, unknown>;
  proof_claim_control: Record<string, unknown>;
  open_questions: string[];
  copy_paste_handoff: string;
  source_grounding_summary: string;
  assumptions: string[];
  missing_context: string[];
  internal_only_notes: string[];
  model_provider: string | null;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PitchDeckHandoffRevisionNote {
  id: string;
  project_id: string;
  handoff_id: string;
  created_by: string;
  note: string;
  created_at: string;
}

export interface PitchDeckHandoffGenerateInput extends ContextPackInput {
  campaign_blueprint_id: string;
  final_selection_id?: string;
  developed_route_id?: string;
  handoff_type?: PitchHandoffType;
  deck_depth?: DeckDepth;
  audience_type?: DeckAudienceType;
  user_instruction?: string;
}

export interface PitchDeckHandoffReview {
  id: string;
  project_id: string;
  pitch_deck_handoff_id: string;
  campaign_blueprint_id: string | null;
  final_selection_id: string | null;
  developed_route_id: string | null;
  idea_card_id: string | null;
  evaluation_id: string | null;
  dossier_id: string | null;
  created_by: string | null;
  review_mode: HandoffReviewMode;
  overall_readiness_verdict: string;
  readiness_score: number;
  client_readiness_status: ClientReadinessStatus;
  narrative_strength_assessment: string;
  slide_logic_assessment: string;
  proof_claim_risk_assessment: string;
  unsupported_claims: string[];
  proof_gaps: string[];
  assumptions: string[];
  missing_context: string[];
  internal_only_risks: string[];
  visual_asset_gaps: string[];
  design_handoff_clarity_assessment: string;
  recommended_fixes: string[];
  do_not_present_yet_warnings: string[];
  copy_paste_improvement_notes: string;
  source_grounding_summary: string;
  model_provider: string | null;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PitchDeckHandoffSlideReview {
  id: string;
  project_id: string;
  review_id: string;
  pitch_deck_handoff_id: string;
  slide_number: number;
  slide_title: string;
  original_readiness_status: string | null;
  reviewer_readiness_status: string;
  slide_job_clarity: string;
  key_message_clarity: string;
  narrative_fit: string;
  proof_status: string;
  claim_risk: string;
  visual_asset_requirement: string;
  client_input_requirement: string;
  internal_only_concern: string;
  genericness_risk: string;
  recommended_fix: string;
  presenter_risk_watchout: string;
  final_recommendation: SlideReviewRecommendation;
  created_at: string;
}

export interface PitchDeckHandoffReviewNote {
  id: string;
  project_id: string;
  review_id: string;
  created_by: string;
  note: string;
  created_at: string;
}

export interface PitchDeckHandoffReviewGenerateInput extends ContextPackInput {
  pitch_deck_handoff_id: string;
  review_mode?: HandoffReviewMode;
  user_instruction?: string;
}

export interface ProjectWorkspaceData {
  notes: ProjectNote[];
  rejectedIdeas: RejectedIdea[];
  shortlistedIdeas: ShortlistedIdea[];
  routes: DevelopedRoute[];
  finalTruth: FinalCampaignTruth | null;
  finalSelections: FinalCampaignTruth[];
  campaignBlueprints: CampaignBlueprint[];
  pitchDeckHandoffs: PitchDeckHandoff[];
  pitchDeckHandoffReviews: PitchDeckHandoffReview[];
  pitchDeckHandoffSlideReviews: PitchDeckHandoffSlideReview[];
}

export interface ApiError {
  error: string;
}
