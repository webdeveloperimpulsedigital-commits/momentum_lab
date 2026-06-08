import type {
  BlueprintDepth,
  ContextPack,
  DevelopedRoute,
  FinalCampaignTruth,
  ProjectDossier,
  ProjectIdeaEvaluation
} from "@momentum-lab/shared";

const depthGuidance: Record<BlueprintDepth, string> = {
  "Lean blueprint": "Concise internal campaign skeleton. Keep sections sharp and short.",
  "Standard blueprint": "Complete working campaign architecture with enough detail for future output generation.",
  "Detailed blueprint": "Deeper campaign system with more executional detail, still not a deck or final copy."
};

export function buildCampaignBlueprintPrompt(input: {
  project: {
    project_name: string;
    client_name: string | null;
    category: string | null;
    market: string | null;
    audience: string | null;
    objective: string | null;
    known_constraints: string | null;
    desired_output_type: string | null;
    brief_notes: string | null;
  };
  finalSelection: FinalCampaignTruth;
  route: DevelopedRoute;
  evaluation: ProjectIdeaEvaluation | null;
  dossier: ProjectDossier | null;
  contextPack: ContextPack;
  blueprintDepth: BlueprintDepth;
  userInstruction?: string;
}) {
  const system = [
    "You are Momentum Lab's internal campaign blueprint engine.",
    "Convert the active final selected route and campaign truth into a structured internal campaign blueprint.",
    "Do not create a client deck, proposal, PDF, social copy, asset-by-asset content, media plan, or finished presentation.",
    "Use only the supplied project metadata, final selection, developed route, evaluation, dossier, and context pack.",
    "Mandatory rule sources are hard guardrails. Strategy sources guide architecture. Inspiration sources are stimulus only and cannot be treated as proof or copied. Evaluation sources guide critique and risk. Context sources are background.",
    "Do not invent numbers, proof points, competitor facts, market data, or unsupported claims.",
    "Clearly separate what is locked, what remains open, proof required, assumptions, missing context, and what should not be claimed yet.",
    "Return strict JSON only."
  ].join("\n");

  const groupedContext = input.contextPack.sections.map((section) => ({
    title: section.title,
    role: section.role,
    chunks: section.chunks.map((chunk) => ({
      source_title: chunk.source_title,
      source_role: chunk.source_role,
      source_scope: chunk.source_scope,
      snippet: chunk.snippet
    }))
  }));

  const user = JSON.stringify(
    {
      required_json_shape: {
        blueprint_title: "short internal blueprint title",
        selected_campaign_truth: "locked campaign truth",
        route_summary: "summary of selected route",
        strategic_problem: "problem the campaign architecture solves",
        audience_tension: "audience tension",
        category_pressure: "category pressure",
        brand_product_truth: "brand/product truth or labelled assumption",
        brand_role: "role of brand",
        campaign_platform_statement: "internal platform statement, not tagline",
        campaign_promise: "campaign promise",
        message_hierarchy: {
          core_campaign_truth: "truth",
          primary_message: "primary message",
          secondary_support_messages: ["support messages"],
          proof_or_reason_to_believe_areas: ["proof areas"],
          possible_calls_to_action: ["optional CTAs"],
          what_not_to_say_yet: ["claims blocked by missing proof"]
        },
        core_narrative_arc: "internal narrative arc",
        execution_pillars: [
          {
            pillar_name: "pillar",
            what_it_does: "role in system",
            audience_job: "audience job",
            possible_formats: ["formats"],
            proof_or_source_dependency: "dependency",
            risks_watchouts: ["risks"]
          }
        ],
        campaign_mechanics: ["mechanics"],
        touchpoint_system: [
          {
            touchpoint: "relevant touchpoint",
            role: "why it matters",
            formats: ["formats"],
            proof_dependency: "proof/source dependency"
          }
        ],
        proof_stack_required: ["proof required before client-facing work"],
        assets_formats_to_explore: ["formats"],
        rollout_logic: "launch or rollout logic",
        risks_watchouts: ["risks"],
        feasibility_notes: "feasibility notes",
        assumptions: ["assumptions"],
        missing_context: ["missing context"],
        open_questions: ["questions before client presentation"],
        next_recommended_action: "next action"
      },
      blueprint_depth: input.blueprintDepth,
      blueprint_depth_guidance: depthGuidance[input.blueprintDepth],
      user_instruction: input.userInstruction ?? null,
      project: input.project,
      final_selection: input.finalSelection,
      developed_route: input.route,
      evaluation: input.evaluation,
      dossier: input.dossier
        ? {
            title: input.dossier.title,
            sections: input.dossier.dossier_content.sections,
            assumptions: input.dossier.assumptions,
            missing_context: input.dossier.missing_context
          }
        : null,
      context_pack: {
        retrieval_scope: input.contextPack.retrieval_scope,
        retrieval_mode: input.contextPack.retrieval_mode,
        mandatory_rules_found: input.contextPack.mandatory_rules_found,
        missing_or_unavailable_context: input.contextPack.missing_or_unavailable_context,
        grouped_context: groupedContext
      }
    },
    null,
    2
  );

  return { system, user };
}

export interface ParsedCampaignBlueprint {
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
}

function requiredString(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Missing blueprint field: ${label}`);
  return text;
}

function stringWithFallback(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

export function parseCampaignBlueprintJson(raw: string): ParsedCampaignBlueprint {
  let stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    stripped = stripped.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(stripped) as Record<string, unknown>;
  const hierarchy = (parsed.message_hierarchy ?? {}) as Record<string, unknown>;
  const proofStack = stringArray(parsed.proof_stack_required);
  const risks = stringArray(parsed.risks_watchouts);
  const assumptions = stringArray(parsed.assumptions);
  const missingContext = stringArray(parsed.missing_context);
  const blueprint: ParsedCampaignBlueprint = {
    blueprint_title: stringWithFallback(parsed.blueprint_title ?? parsed.campaign_blueprint_title, "Campaign Blueprint"),
    selected_campaign_truth: stringWithFallback(parsed.selected_campaign_truth, "Selected campaign truth to be preserved"),
    route_summary: stringWithFallback(parsed.route_summary, "Selected route summary to be refined"),
    strategic_problem: stringWithFallback(parsed.strategic_problem, "Strategic problem requires further sharpening"),
    audience_tension: stringWithFallback(parsed.audience_tension, "Audience tension requires confirmation"),
    category_pressure: stringWithFallback(parsed.category_pressure, "Category pressure requires confirmation"),
    brand_product_truth: stringWithFallback(parsed.brand_product_truth, "Brand/product truth requires proof"),
    brand_role: stringWithFallback(parsed.brand_role, "Brand role requires refinement"),
    campaign_platform_statement: stringWithFallback(parsed.campaign_platform_statement, "Internal campaign platform to refine"),
    campaign_promise: stringWithFallback(parsed.campaign_promise, "Campaign promise requires proof before client-facing use"),
    message_hierarchy: Object.keys(hierarchy).length
      ? hierarchy
      : {
          core_campaign_truth: parsed.selected_campaign_truth ?? "Selected campaign truth",
          primary_message: "Primary message requires refinement",
          secondary_support_messages: [],
          proof_or_reason_to_believe_areas: proofStack,
          possible_calls_to_action: [],
          what_not_to_say_yet: ["Do not make unsupported claims before proof is gathered"]
        },
    core_narrative_arc: stringWithFallback(parsed.core_narrative_arc, "Internal narrative arc requires refinement"),
    execution_pillars: objectArray(parsed.execution_pillars),
    campaign_mechanics: stringArray(parsed.campaign_mechanics),
    touchpoint_system: objectArray(parsed.touchpoint_system),
    proof_stack_required: proofStack.length ? proofStack : ["Proof required before client-facing work"],
    assets_formats_to_explore: stringArray(parsed.assets_formats_to_explore),
    rollout_logic: stringWithFallback(parsed.rollout_logic, "Rollout logic requires refinement"),
    risks_watchouts: risks.length ? risks : ["Risk: unsupported claims must not be used as facts"],
    feasibility_notes: stringWithFallback(parsed.feasibility_notes, "Feasibility requires review before production planning"),
    assumptions: assumptions.length ? assumptions : ["Assumptions require validation"],
    missing_context: missingContext.length ? missingContext : ["Missing context should be resolved before client presentation"],
    open_questions: stringArray(parsed.open_questions).length ? stringArray(parsed.open_questions) : ["What proof is required before client-facing work?"],
    next_recommended_action: stringWithFallback(parsed.next_recommended_action, "Review blueprint proof gaps and refine")
  };

  if (!blueprint.execution_pillars.length) {
    blueprint.execution_pillars = [
      {
        pillar_name: "Proof-led campaign architecture",
        what_it_does: "Keeps the selected route grounded while the campaign system is refined",
        audience_job: "Clarify why the campaign should matter",
        possible_formats: blueprint.assets_formats_to_explore,
        proof_or_source_dependency: blueprint.proof_stack_required.join("; "),
        risks_watchouts: blueprint.risks_watchouts
      }
    ];
  }
  if (!blueprint.touchpoint_system.length) {
    blueprint.touchpoint_system = [
      {
        touchpoint: "Campaign architecture to refine",
        role: "Placeholder internal touchpoint until more context confirms channels",
        formats: blueprint.assets_formats_to_explore,
        proof_dependency: blueprint.proof_stack_required.join("; ")
      }
    ];
  }
  return blueprint;
}
