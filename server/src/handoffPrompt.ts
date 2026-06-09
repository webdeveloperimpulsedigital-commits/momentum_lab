import type {
  CampaignBlueprint,
  ContextPack,
  DeckAudienceType,
  DeckDepth,
  DevelopedRoute,
  FinalCampaignTruth,
  PitchHandoffType
} from "@momentum-lab/shared";

const deckDepthGuidance: Record<DeckDepth, string> = {
  "Short deck": "Recommend roughly 6 to 8 slides. Avoid filler.",
  "Standard deck": "Recommend roughly 10 to 12 slides. Build a complete pitch narrative with concise slide fields.",
  "Detailed deck": "Recommend roughly 15 to 22 slides only where useful. Still do not create the deck."
};

function truncateText(value: unknown, maxLength = 700) {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 4).trim()} ...` : text;
}

function compactList(value: unknown, maxItems = 8, maxItemLength = 260) {
  return Array.isArray(value)
    ? value.map((item) => truncateText(item, maxItemLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function compactJson(value: unknown, maxLength = 900) {
  if (value === null || value === undefined) return null;
  return truncateText(JSON.stringify(value), maxLength);
}

function compactBlueprint(blueprint: CampaignBlueprint) {
  return {
    id: blueprint.id,
    blueprint_depth: blueprint.blueprint_depth,
    blueprint_title: truncateText(blueprint.blueprint_title, 220),
    selected_campaign_truth: truncateText(blueprint.selected_campaign_truth, 520),
    route_summary: truncateText(blueprint.route_summary, 520),
    strategic_problem: truncateText(blueprint.strategic_problem, 420),
    audience_tension: truncateText(blueprint.audience_tension, 420),
    category_pressure: truncateText(blueprint.category_pressure, 420),
    brand_product_truth: truncateText(blueprint.brand_product_truth, 420),
    brand_role: truncateText(blueprint.brand_role, 320),
    campaign_platform_statement: truncateText(blueprint.campaign_platform_statement, 520),
    campaign_promise: truncateText(blueprint.campaign_promise, 420),
    message_hierarchy: compactJson(blueprint.message_hierarchy, 900),
    core_narrative_arc: truncateText(blueprint.core_narrative_arc, 700),
    execution_pillars: blueprint.execution_pillars.slice(0, 5).map((pillar) => compactJson(pillar, 500)),
    campaign_mechanics: compactList(blueprint.campaign_mechanics, 8, 220),
    touchpoint_system: blueprint.touchpoint_system.slice(0, 6).map((touchpoint) => compactJson(touchpoint, 450)),
    proof_stack_required: compactList(blueprint.proof_stack_required, 10, 260),
    assets_formats_to_explore: compactList(blueprint.assets_formats_to_explore, 10, 220),
    rollout_logic: truncateText(blueprint.rollout_logic, 420),
    risks_watchouts: compactList(blueprint.risks_watchouts, 8, 260),
    feasibility_notes: truncateText(blueprint.feasibility_notes, 420),
    assumptions: compactList(blueprint.assumptions, 8, 260),
    missing_context: compactList(blueprint.missing_context, 8, 260),
    open_questions: compactList(blueprint.open_questions, 8, 260),
    next_recommended_action: truncateText(blueprint.next_recommended_action, 320)
  };
}

function compactFinalSelection(finalSelection: FinalCampaignTruth | null) {
  if (!finalSelection) return null;
  return {
    id: finalSelection.id,
    final_route_title: truncateText(finalSelection.final_route_title, 220),
    final_campaign_truth: truncateText(finalSelection.final_campaign_truth, 520),
    selection_rationale: truncateText(finalSelection.selection_rationale, 520),
    why_this_route_won: truncateText(finalSelection.why_this_route_won, 420),
    rejected_or_deprioritised_notes: truncateText(finalSelection.rejected_or_deprioritised_notes, 320),
    proof_required: truncateText(finalSelection.proof_required, 420),
    risks_watchouts: truncateText(finalSelection.risks_watchouts, 420),
    assumptions: truncateText(finalSelection.assumptions, 320),
    missing_context: truncateText(finalSelection.missing_context, 320),
    next_action: truncateText(finalSelection.next_action, 260)
  };
}

function compactRoute(route: DevelopedRoute | null) {
  if (!route) return null;
  return {
    id: route.id,
    route_depth: route.route_depth,
    route_title: truncateText(route.route_title ?? route.route_name, 220),
    route_summary: truncateText(route.route_summary, 520),
    core_campaign_thought: truncateText(route.core_campaign_thought ?? route.core_thought, 520),
    audience_tension: truncateText(route.audience_tension, 360),
    category_pressure: truncateText(route.category_pressure, 360),
    brand_product_truth: truncateText(route.brand_product_truth, 360),
    brand_role: truncateText(route.brand_role, 260),
    campaign_mechanics: compactList(route.campaign_mechanics, 8, 220),
    execution_system: compactJson(route.execution_system, 800),
    sample_touchpoints: compactList(route.sample_touchpoints, 8, 220),
    proof_needed: truncateText(route.proof_needed, 420),
    risks: truncateText(route.risks ?? route.risk_notes, 420),
    feasibility_notes: truncateText(route.feasibility_notes, 320),
    source_grounding_summary: truncateText(route.source_grounding_summary, 320),
    assumptions: compactList(route.assumptions, 6, 220),
    missing_context: compactList(route.missing_context, 6, 220),
    next_refinement_questions: compactList(route.next_refinement_questions, 6, 220)
  };
}

function compactContextPack(contextPack: ContextPack) {
  return {
    retrieval_scope: contextPack.retrieval_scope,
    retrieval_mode: contextPack.retrieval_mode,
    total_chunks: contextPack.total_chunks,
    total_characters: contextPack.total_characters,
    mandatory_rules_found: contextPack.mandatory_rules_found,
    missing_or_unavailable_context: compactList(contextPack.missing_or_unavailable_context, 6, 220),
    sections: contextPack.sections.map((section) => ({
      title: section.title,
      role: section.role,
      chunks: section.chunks.map((chunk) => ({
        source_title: truncateText(chunk.source_title, 160),
        source_role: chunk.source_role,
        source_scope: chunk.source_scope,
        snippet: truncateText(chunk.snippet, chunk.source_role === "mandatory_rule" ? 650 : 420)
      }))
    }))
  };
}

export function buildPitchDeckHandoffPrompt(input: {
  project: {
    project_name: string;
    client_name: string | null;
    category: string | null;
    market: string | null;
    audience: string | null;
    objective: string | null;
    desired_output_type: string | null;
    brief_notes: string | null;
  };
  blueprint: CampaignBlueprint;
  finalSelection: FinalCampaignTruth | null;
  route: DevelopedRoute | null;
  contextPack: ContextPack;
  handoffType: PitchHandoffType;
  deckDepth: DeckDepth;
  audienceType: DeckAudienceType;
  userInstruction?: string;
}) {
  const system = [
    "You are Momentum Lab's pitch deck structure handoff engine.",
    "Create deck architecture and build instructions only. Do not create PPT, PDF, slide files, rendered slides, proposal exports, or final client presentation files.",
    "The output will be copy-pasted into a separate PPT design/build project.",
    "Use only the supplied project, campaign blueprint, final selection, developed route, and context pack.",
    "Mandatory rule sources are hard guardrails. Strategy sources guide deck logic. Inspiration sources are visual/creative stimulus only and not proof. Evaluation sources flag risk. Context sources are background.",
    "Separate supported claims, assumptions, proof gaps, internal-only notes, and do-not-present claims.",
    "Return strict JSON only."
  ].join("\n");

  const user = JSON.stringify(
    {
      required_json_shape: {
        deck_purpose: {
          achieve: "what this deck needs to achieve",
          audience: "who it is for",
          decision: "decision it should help audience make"
        },
        core_campaign_truth: {
          final_campaign_truth: "truth",
          why_selected: "why route was selected",
          strategic_role: "role of idea"
        },
        narrative_arc: {
          opening_problem: "problem",
          category_tension: "category tension",
          audience_tension: "audience/buyer tension",
          brand_product_truth: "truth",
          campaign_platform: "platform",
          execution_system: "execution system",
          proof_and_feasibility: "proof",
          next_steps: "next steps"
        },
        slide_structure: [
          {
            slide_number: 1,
            slide_title: "title",
            slide_job: "job",
            key_message: "message",
            content_points: ["points"],
            proof_or_source_needed: ["proof"],
            visual_direction: "visual treatment",
            suggested_asset_direction: "asset direction",
            speaker_note_or_presenter_intent: "speaker intent",
            risk_watchout: "risk",
            readiness_status: "Ready to use | Needs proof | Needs client input | Needs visual asset | Internal only | Do not present yet"
          }
        ],
        section_breaks: ["sections"],
        visual_design_notes: {
          mood_or_treatment_direction: "mood",
          visual_metaphors: ["metaphors"],
          asset_needs: ["assets"],
          animation_opportunities: ["where animation may help"],
          restraint_notes: ["where restraint is better"],
          ppt_project_exploration: ["what the PPT project should explore"]
        },
        proof_claim_control: {
          supported_claims: ["claims"],
          claims_needing_proof: ["claims"],
          claims_not_ready_for_client_deck: ["claims"],
          data_or_assets_needed: ["needs"]
        },
        open_questions: ["questions"],
        copy_paste_handoff: "plain markdown/text handoff block",
        source_grounding_summary: "summary without dumping snippets",
        assumptions: ["assumptions"],
        missing_context: ["missing context"],
        internal_only_notes: ["internal-only notes"]
      },
      handoff_type: input.handoffType,
      deck_depth: input.deckDepth,
      deck_depth_guidance: deckDepthGuidance[input.deckDepth],
      audience_type: input.audienceType,
      user_instruction: input.userInstruction ?? null,
      project: input.project,
      campaign_blueprint: compactBlueprint(input.blueprint),
      final_selection: compactFinalSelection(input.finalSelection),
      developed_route: compactRoute(input.route),
      context_pack: compactContextPack(input.contextPack)
    },
    null,
    0
  );

  return { system, user };
}

export interface ParsedPitchDeckHandoff {
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
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function objectValue(value: unknown, fallback: Record<string, unknown>) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : fallback;
}

export function parsePitchDeckHandoffJson(raw: string): ParsedPitchDeckHandoff {
  let stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) stripped = stripped.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(stripped) as Record<string, unknown>;
  const handoff: ParsedPitchDeckHandoff = {
    deck_purpose: objectValue(parsed.deck_purpose, {
      achieve: "Clarify the campaign direction for deck build",
      audience: "Deck audience to confirm",
      decision: "Approve next presentation build step"
    }),
    core_campaign_truth: objectValue(parsed.core_campaign_truth, {
      final_campaign_truth: "Campaign truth to preserve",
      why_selected: "Selection rationale to preserve",
      strategic_role: "Strategic role to clarify"
    }),
    narrative_arc: objectValue(parsed.narrative_arc, {
      opening_problem: "Problem",
      category_tension: "Category tension",
      audience_tension: "Audience tension",
      brand_product_truth: "Brand/product truth",
      campaign_platform: "Campaign platform",
      execution_system: "Execution system",
      proof_and_feasibility: "Proof and feasibility",
      next_steps: "Next steps"
    }),
    slide_structure: objectArray(parsed.slide_structure),
    section_breaks: stringArray(parsed.section_breaks),
    visual_design_notes: objectValue(parsed.visual_design_notes, {
      mood_or_treatment_direction: "Design direction to explore",
      asset_needs: ["Visual assets need confirmation"]
    }),
    proof_claim_control: objectValue(parsed.proof_claim_control, {
      supported_claims: [],
      claims_needing_proof: ["Claims need proof before presenting"],
      claims_not_ready_for_client_deck: ["Unsupported claims"],
      data_or_assets_needed: ["Proof/data/assets needed"]
    }),
    open_questions: stringArray(parsed.open_questions),
    copy_paste_handoff: String(parsed.copy_paste_handoff ?? "").trim(),
    source_grounding_summary: String(parsed.source_grounding_summary ?? "").trim(),
    assumptions: stringArray(parsed.assumptions),
    missing_context: stringArray(parsed.missing_context),
    internal_only_notes: stringArray(parsed.internal_only_notes)
  };
  if (!handoff.slide_structure.length) {
    handoff.slide_structure = [
      {
        slide_number: 1,
        slide_title: "Campaign direction",
        slide_job: "Introduce the selected campaign architecture",
        key_message: "The campaign truth and blueprint are ready for deck build planning",
        content_points: ["Use the approved blueprint as source"],
        proof_or_source_needed: ["Confirm proof gaps before client-facing claims"],
        visual_direction: "Simple strategic framing",
        suggested_asset_direction: "TBD by PPT design project",
        speaker_note_or_presenter_intent: "Frame this as a build handoff, not a finished deck",
        risk_watchout: "Do not overclaim",
        readiness_status: "Internal only"
      }
    ];
  }
  if (!handoff.section_breaks.length) handoff.section_breaks = ["Context", "Campaign Truth", "Execution System", "Proof", "Next Steps"];
  if (!handoff.open_questions.length) handoff.open_questions = ["What proof is needed before client-facing presentation?"];
  if (!handoff.copy_paste_handoff) handoff.copy_paste_handoff = "Pitch deck handoff\n\nUse the stored campaign blueprint to build a separate PPT project. Do not treat this as a finished deck.";
  if (!handoff.source_grounding_summary) handoff.source_grounding_summary = "Grounded in selected campaign blueprint and permission-checked context pack.";
  if (!handoff.assumptions.length) handoff.assumptions = ["Assumptions require validation before presenting."];
  if (!handoff.missing_context.length) handoff.missing_context = ["Missing context should be resolved before deck build."];
  if (!handoff.internal_only_notes.length) handoff.internal_only_notes = ["This is a build handoff, not a client-facing deck."];
  return handoff;
}
