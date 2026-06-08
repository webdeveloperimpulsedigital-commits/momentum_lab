import type {
  ContextPack,
  ProjectDossier,
  ProjectIdeaCard,
  ProjectIdeaEvaluation,
  RouteDepth
} from "@momentum-lab/shared";

const depthGuidance: Record<RouteDepth, string> = {
  "Light route": "Concise route expansion for quick comparison. Keep sections short.",
  "Standard route": "Practical campaign route with clear strategy, mechanics, and execution system.",
  "Deep route": "More detailed strategic and executional development, but still not a final deck or proposal."
};

export function buildRouteDevelopmentPrompt(input: {
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
  idea: ProjectIdeaCard;
  evaluation: ProjectIdeaEvaluation | null;
  dossier: ProjectDossier | null;
  contextPack: ContextPack;
  routeDepth: RouteDepth;
  userInstruction?: string;
}) {
  const system = [
    "You are Momentum Lab's campaign route development engine.",
    "Develop one selected thought-starter into a structured campaign route. Do not create a final campaign, deck, proposal, or final campaign truth.",
    "Use only the supplied project metadata, idea card, evaluation, dossier, and context pack.",
    "Mandatory rule sources must be followed and any constraint must be flagged.",
    "Strategy sources guide platform discipline and tension. Inspiration sources are stimulus only and must not be copied or treated as proof. Evaluation sources strengthen the route and flag risk. Context sources are background.",
    "Preserve traceability: state what was retained from the idea, what was sharpened from evaluation, and what remains risky.",
    "Do not present unsupported claims as facts. Put proof gaps in proof_needed, assumptions, and missing_context.",
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
        route_title: "short route title",
        route_summary: "concise summary",
        core_campaign_thought: "campaign thought",
        audience_tension: "audience tension",
        category_pressure: "category pressure",
        brand_product_truth: "brand/product truth or labelled assumption",
        brand_role: "strategic role of brand",
        non_generic_reason: "why sharper than generic category work",
        campaign_mechanics: ["key mechanics"],
        execution_system: {
          hero_film_or_main_content: "optional if relevant",
          social_system: "optional if relevant",
          digital_assets: "optional if relevant",
          pr_or_stunt_potential: "optional if relevant",
          experiential_or_activation: "optional if relevant",
          sales_or_b2b_enablement: "optional if relevant",
          internal_or_employer_branding: "optional if relevant",
          landing_page_or_conversion: "optional if relevant"
        },
        sample_touchpoints: ["touchpoints"],
        proof_needed: ["proof gaps"],
        risks_watchouts: ["risks"],
        feasibility_notes: "feasibility notes",
        source_grounding_summary: "grounding summary",
        assumptions: ["assumptions"],
        missing_context: ["missing context"],
        next_refinement_questions: ["questions"],
        retained_from_original_idea: ["what stayed"],
        sharpened_from_evaluation: ["what changed"],
        remaining_risks_or_weaknesses: ["remaining risks"]
      },
      route_depth: input.routeDepth,
      route_depth_guidance: depthGuidance[input.routeDepth],
      user_instruction: input.userInstruction ?? null,
      project: input.project,
      idea: input.idea,
      evaluation: input.evaluation,
      dossier: input.dossier
        ? {
            title: input.dossier.title,
            sections: input.dossier.dossier_content.sections,
            assumptions: input.dossier.assumptions,
            missing_context: input.dossier.missing_context,
            grounding_metadata: input.dossier.grounding_metadata
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

export interface ParsedDevelopedRoute {
  route_title: string;
  route_summary: string;
  core_campaign_thought: string;
  audience_tension: string;
  category_pressure: string;
  brand_product_truth: string;
  brand_role: string;
  non_generic_reason: string;
  campaign_mechanics: string[];
  execution_system: Record<string, string>;
  sample_touchpoints: string[];
  proof_needed: string[];
  risks_watchouts: string[];
  feasibility_notes: string;
  source_grounding_summary: string;
  assumptions: string[];
  missing_context: string[];
  next_refinement_questions: string[];
}

function requiredString(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Missing route field: ${label}`);
  return text;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

export function parseRouteDevelopmentJson(raw: string): ParsedDevelopedRoute {
  const stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(stripped) as Record<string, unknown>;
  const executionSource = (parsed.execution_system ?? {}) as Record<string, unknown>;
  const execution = Object.fromEntries(
    Object.entries(executionSource)
      .map(([key, value]) => [key, String(value ?? "").trim()])
      .filter(([, value]) => value)
  );

  const route: ParsedDevelopedRoute = {
    route_title: requiredString(parsed.route_title, "route_title"),
    route_summary: requiredString(parsed.route_summary, "route_summary"),
    core_campaign_thought: requiredString(parsed.core_campaign_thought, "core_campaign_thought"),
    audience_tension: requiredString(parsed.audience_tension, "audience_tension"),
    category_pressure: requiredString(parsed.category_pressure, "category_pressure"),
    brand_product_truth: requiredString(parsed.brand_product_truth, "brand_product_truth"),
    brand_role: requiredString(parsed.brand_role, "brand_role"),
    non_generic_reason: requiredString(parsed.non_generic_reason, "non_generic_reason"),
    campaign_mechanics: stringArray(parsed.campaign_mechanics),
    execution_system: execution,
    sample_touchpoints: stringArray(parsed.sample_touchpoints),
    proof_needed: stringArray(parsed.proof_needed),
    risks_watchouts: stringArray(parsed.risks_watchouts),
    feasibility_notes: requiredString(parsed.feasibility_notes, "feasibility_notes"),
    source_grounding_summary: requiredString(parsed.source_grounding_summary, "source_grounding_summary"),
    assumptions: stringArray(parsed.assumptions),
    missing_context: stringArray(parsed.missing_context),
    next_refinement_questions: stringArray(parsed.next_refinement_questions)
  };

  if (!route.campaign_mechanics.length || !route.proof_needed.length) {
    throw new Error("Route output is incomplete");
  }
  return route;
}
