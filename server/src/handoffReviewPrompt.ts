import type {
  CampaignBlueprint,
  ContextPack,
  DevelopedRoute,
  FinalCampaignTruth,
  HandoffReviewMode,
  PitchDeckHandoff,
  SlideReviewRecommendation
} from "@momentum-lab/shared";

export interface ParsedHandoffReview {
  overall_readiness_verdict: string;
  readiness_score: number;
  client_readiness_status: string;
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
  slide_reviews: Array<{
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
  }>;
}

export function buildPitchDeckHandoffReviewPrompt(input: {
  project: { project_name: string; client_name: string | null; category: string | null; audience: string | null; objective: string | null };
  handoff: PitchDeckHandoff;
  blueprint: CampaignBlueprint | null;
  finalSelection: FinalCampaignTruth | null;
  route: DevelopedRoute | null;
  contextPack: ContextPack;
  reviewMode: HandoffReviewMode;
  userInstruction?: string;
}) {
  const system = [
    "You are Momentum Lab's pitch deck handoff review engine.",
    "Review and diagnose a textual pitch deck build handoff before it is copied into a separate PPT design/build project.",
    "Do not create a PPT, PDF, slide rendering, deck design, proposal export, or client-facing file.",
    "Use only the supplied handoff, campaign blueprint, final selection, route, and permission-checked context pack.",
    "Mandatory rule sources are hard guardrails. Inspiration sources are stimulus only and must never be proof.",
    "Flag unsupported numeric claims, broad unsupported claims, inspiration-as-proof mistakes, client-facing claims without verification, category claims needing external proof, and product/business claims needing client confirmation.",
    "Separate internal-only material from client-presentable content.",
    "Return strict JSON only."
  ].join("\n");
  const user = JSON.stringify(
    {
      required_json_shape: {
        overall_readiness_verdict: "verdict",
        readiness_score: 0,
        client_readiness_status: "Ready for PPT build | Needs proof before PPT build | Needs client input before PPT build | Needs visual assets before PPT build | Needs strategic revision | Internal review only | Do not move ahead yet",
        narrative_strength_assessment: "assessment",
        slide_logic_assessment: "assessment",
        proof_claim_risk_assessment: "assessment",
        unsupported_claims: ["claims"],
        proof_gaps: ["gaps"],
        assumptions: ["assumptions"],
        missing_context: ["missing context"],
        internal_only_risks: ["risks"],
        visual_asset_gaps: ["asset gaps"],
        design_handoff_clarity_assessment: "assessment",
        recommended_fixes: ["fixes"],
        do_not_present_yet_warnings: ["warnings"],
        copy_paste_improvement_notes: "notes for separate PPT project",
        source_grounding_summary: "summary without snippets",
        slide_reviews: [
          {
            slide_number: 1,
            slide_title: "title",
            original_readiness_status: "status",
            reviewer_readiness_status: "status",
            slide_job_clarity: "diagnostic",
            key_message_clarity: "diagnostic",
            narrative_fit: "diagnostic",
            proof_status: "diagnostic",
            claim_risk: "diagnostic",
            visual_asset_requirement: "diagnostic",
            client_input_requirement: "diagnostic",
            internal_only_concern: "diagnostic",
            genericness_risk: "diagnostic",
            recommended_fix: "fix",
            presenter_risk_watchout: "watchout",
            final_recommendation: "Keep as is | Keep with minor edits | Needs proof | Needs client input | Needs stronger visual direction | Merge with another slide | Move earlier | Move later | Convert to internal-only | Do not present yet | Remove from deck structure"
          }
        ]
      },
      review_mode: input.reviewMode,
      user_instruction: input.userInstruction ?? null,
      project: input.project,
      pitch_deck_handoff: input.handoff,
      campaign_blueprint: input.blueprint,
      final_selection: input.finalSelection,
      developed_route: input.route,
      context_pack: {
        retrieval_scope: input.contextPack.retrieval_scope,
        retrieval_mode: input.contextPack.retrieval_mode,
        mandatory_rules_found: input.contextPack.mandatory_rules_found,
        missing_or_unavailable_context: input.contextPack.missing_or_unavailable_context,
        sections: input.contextPack.sections.map((section) => ({
          title: section.title,
          role: section.role,
          chunks: section.chunks.map((chunk) => ({
            source_title: chunk.source_title,
            source_role: chunk.source_role,
            source_scope: chunk.source_scope,
            snippet: chunk.snippet
          }))
        }))
      }
    },
    null,
    2
  );
  return { system, user };
}

const statuses = new Set([
  "Ready for PPT build",
  "Needs proof before PPT build",
  "Needs client input before PPT build",
  "Needs visual assets before PPT build",
  "Needs strategic revision",
  "Internal review only",
  "Do not move ahead yet"
]);

const recommendations = new Set<SlideReviewRecommendation>([
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
]);

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function requiredText(value: unknown, fallback: string) {
  return String(value ?? "").trim() || fallback;
}

export function parsePitchDeckHandoffReviewJson(raw: string, handoff: PitchDeckHandoff): ParsedHandoffReview {
  let stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) stripped = stripped.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(stripped) as Record<string, unknown>;
  const score = Math.max(0, Math.min(100, Number(parsed.readiness_score ?? 60)));
  const status = requiredText(parsed.client_readiness_status, "Needs proof before PPT build");
  const slideReviews = Array.isArray(parsed.slide_reviews) ? parsed.slide_reviews : [];
  return {
    overall_readiness_verdict: requiredText(parsed.overall_readiness_verdict, "Review requires fixes before PPT build"),
    readiness_score: Number.isFinite(score) ? score : 60,
    client_readiness_status: statuses.has(status) ? status : "Needs proof before PPT build",
    narrative_strength_assessment: requiredText(parsed.narrative_strength_assessment, "Narrative needs review"),
    slide_logic_assessment: requiredText(parsed.slide_logic_assessment, "Slide logic needs review"),
    proof_claim_risk_assessment: requiredText(parsed.proof_claim_risk_assessment, "Proof and claims need review"),
    unsupported_claims: stringArray(parsed.unsupported_claims),
    proof_gaps: stringArray(parsed.proof_gaps),
    assumptions: stringArray(parsed.assumptions),
    missing_context: stringArray(parsed.missing_context),
    internal_only_risks: stringArray(parsed.internal_only_risks),
    visual_asset_gaps: stringArray(parsed.visual_asset_gaps),
    design_handoff_clarity_assessment: requiredText(parsed.design_handoff_clarity_assessment, "Design handoff clarity needs review"),
    recommended_fixes: stringArray(parsed.recommended_fixes),
    do_not_present_yet_warnings: stringArray(parsed.do_not_present_yet_warnings),
    copy_paste_improvement_notes: requiredText(parsed.copy_paste_improvement_notes, "Clarify proof gaps and internal-only notes before copy-paste."),
    source_grounding_summary: requiredText(parsed.source_grounding_summary, "Grounded in selected handoff and permission-checked context."),
    slide_reviews: slideReviews.map((item, index) => {
      const slide = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const rec = requiredText(slide.final_recommendation, "Needs proof") as SlideReviewRecommendation;
      return {
        slide_number: Number(slide.slide_number ?? index + 1),
        slide_title: requiredText(slide.slide_title, `Slide ${index + 1}`),
        original_readiness_status: slide.original_readiness_status ? String(slide.original_readiness_status) : null,
        reviewer_readiness_status: requiredText(slide.reviewer_readiness_status, "Needs proof"),
        slide_job_clarity: requiredText(slide.slide_job_clarity, "Slide job needs sharpening"),
        key_message_clarity: requiredText(slide.key_message_clarity, "Key message needs sharpening"),
        narrative_fit: requiredText(slide.narrative_fit, "Narrative fit needs review"),
        proof_status: requiredText(slide.proof_status, "Proof required"),
        claim_risk: requiredText(slide.claim_risk, "Claim risk requires review"),
        visual_asset_requirement: requiredText(slide.visual_asset_requirement, "Visual asset needs clarification"),
        client_input_requirement: requiredText(slide.client_input_requirement, "Client input may be required"),
        internal_only_concern: requiredText(slide.internal_only_concern, "Internal-only material should be separated"),
        genericness_risk: requiredText(slide.genericness_risk, "Genericness risk should be checked"),
        recommended_fix: requiredText(slide.recommended_fix, "Clarify slide before deck build"),
        presenter_risk_watchout: requiredText(slide.presenter_risk_watchout, "Presenter should avoid overclaiming"),
        final_recommendation: recommendations.has(rec) ? rec : "Needs proof"
      };
    }).slice(0, Math.max(1, handoff.slide_structure.length || 1))
  };
}

export function fallbackPitchDeckHandoffReview(handoff: PitchDeckHandoff): ParsedHandoffReview {
  const proofGaps = [
    ...((handoff.proof_claim_control.claims_needing_proof as string[] | undefined) ?? []),
    "Confirm proof before client-facing PPT build"
  ];
  const slideReviews = handoff.slide_structure.map((slide, index) => ({
    slide_number: Number(slide.slide_number ?? index + 1),
    slide_title: requiredText(slide.slide_title, `Slide ${index + 1}`),
    original_readiness_status: slide.readiness_status ? String(slide.readiness_status) : null,
    reviewer_readiness_status: "Needs proof",
    slide_job_clarity: "Slide job is present but should be checked for specificity.",
    key_message_clarity: "Key message should be made sharper before deck build.",
    narrative_fit: "Fits the handoff arc but needs review against surrounding slides.",
    proof_status: "Proof gaps must stay visible.",
    claim_risk: "Avoid unsupported or broad client-facing claims.",
    visual_asset_requirement: "Visual asset direction needs confirmation by PPT project.",
    client_input_requirement: "Client input may be required for proof or business claims.",
    internal_only_concern: "Keep risk notes and uncertainty out of client-facing slides.",
    genericness_risk: "Check for generic agency phrasing.",
    recommended_fix: "Tighten message, proof, and asset direction before copy-paste.",
    presenter_risk_watchout: "Presenter should not frame assumptions as facts.",
    final_recommendation: "Needs proof" as SlideReviewRecommendation
  }));
  return {
    overall_readiness_verdict: "Mostly ready as a handoff, but proof and client-input checks are required before PPT build.",
    readiness_score: 72,
    client_readiness_status: "Needs proof before PPT build",
    narrative_strength_assessment: "Narrative arc is present; sharpen weak transitions before copy-paste.",
    slide_logic_assessment: "Slide structure exists; review for repetition and unnecessary slides.",
    proof_claim_risk_assessment: "Claims need proof separation before client-facing use.",
    unsupported_claims: ["Broad or numeric claims must be verified before deck build"],
    proof_gaps: proofGaps,
    assumptions: handoff.assumptions,
    missing_context: handoff.missing_context,
    internal_only_risks: handoff.internal_only_notes,
    visual_asset_gaps: ["Visual asset requirements need final confirmation"],
    design_handoff_clarity_assessment: "Design notes are usable but should be clarified where assets are missing.",
    recommended_fixes: ["Separate internal notes", "Clarify proof gaps", "Sharpen slide jobs"],
    do_not_present_yet_warnings: ["Do not present unverified claims or internal-only caveats"],
    copy_paste_improvement_notes: "Before copying to the PPT project, add proof labels, client-input needs, and clearer asset direction.",
    source_grounding_summary: "Review is grounded in the selected handoff and permission-checked context.",
    slide_reviews: slideReviews.length ? slideReviews : [{
      slide_number: 1,
      slide_title: "Handoff review",
      original_readiness_status: null,
      reviewer_readiness_status: "Needs proof",
      slide_job_clarity: "Slide job needs definition",
      key_message_clarity: "Key message needs definition",
      narrative_fit: "Narrative fit requires review",
      proof_status: "Proof required",
      claim_risk: "Avoid unsupported claims",
      visual_asset_requirement: "Asset requirement needs definition",
      client_input_requirement: "Client input may be required",
      internal_only_concern: "Separate internal material",
      genericness_risk: "Check genericness",
      recommended_fix: "Clarify before PPT build",
      presenter_risk_watchout: "Do not overclaim",
      final_recommendation: "Needs proof"
    }]
  };
}
