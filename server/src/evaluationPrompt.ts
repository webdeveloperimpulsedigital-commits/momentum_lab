import type {
  ContextPack,
  EvaluationDimensionKey,
  EvaluationMode,
  EvaluationRecommendedAction,
  ProjectDossier,
  ProjectIdeaCard
} from "@momentum-lab/shared";

const dimensionKeys: EvaluationDimensionKey[] = [
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
];

const recommendedActions: EvaluationRecommendedAction[] = [
  "Reject",
  "Revise",
  "Shortlist",
  "Develop",
  "Park for later"
];

const modeGuidance: Record<EvaluationMode, string> = {
  "Quick screen": "Fast triage. Be concise and decisive; focus on obvious strengths, flaws, and next action.",
  "Strategic review": "Balanced strategic and creative judgement across all dimensions.",
  "Creative red-team": "Be sharper and more skeptical. Stress-test memory value, cliché, approval risk, and whether it is really an idea.",
  "Commercial feasibility check": "Prioritise proof, operational feasibility, approval risk, budget sensitivity, and legal or claim risk.",
  "Anti-generic audit": "Hunt for generic language, familiar mechanics, category cliché, and ideas competitors could comfortably run."
};

export function buildIdeaEvaluationPrompt(input: {
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
  ideas: ProjectIdeaCard[];
  contextPack: ContextPack;
  dossier: ProjectDossier | null;
  evaluationMode: EvaluationMode;
}) {
  const system = [
    "You are Momentum Lab's idea evaluation, red-team, and sharpness scoring engine.",
    "Evaluate rough thought-starter cards. Do not develop polished campaign routes.",
    "Use only the supplied project metadata, idea cards, dossier, and context pack.",
    "Scores must be useful, not decorative. Low scores need concrete reasons.",
    "Mandatory rule sources are hard guardrails. Flag any possible conflict.",
    "Strategy sources shape strategic fit and tension. Inspiration sources are stimulus and comparison only, never proof. Evaluation sources should be used heavily for critique. Context sources are background.",
    "Flag unsupported claims, assumptions, feasibility risks, generic language, and structural cliché.",
    "Anti-generic checks include but are not limited to: unlock your potential, transform the future, empower people, redefine the category, celebrate excellence, drive impact, innovation-led growth, generic human montage, founder story, testimonial film, social media challenge, AI theatre, and polished but empty language.",
    "Red-team questions: Is this actually an idea or just a format? Is the tension sharp enough? Is it too close to category cliché? Is it relying on unproven claims? Could the client approve it? Could the brand own it? Is execution doing the strategy's job? Does it have memory value? Does it need more proof, bravery, simplicity, or specificity?",
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
        evaluations: [
          {
            idea_card_id: "uuid from supplied idea card",
            idea_title: "idea title",
            overall_verdict: "concise verdict",
            strongest_aspect: "strongest aspect",
            weakest_aspect: "weakest aspect",
            scores: Object.fromEntries(dimensionKeys.map((key) => [key, "integer 1-5"])),
            overall_sharpness_score: "integer 1-10",
            genericness_risk_score: "integer 1-10",
            development_readiness: "Low | Medium | High",
            source_grounding_assessment: "grounding assessment",
            unsupported_claims: ["unsupported claims or assumptions"],
            feasibility_risks: ["feasibility risks"],
            sharpness_suggestions: ["ways to sharpen"],
            recommended_action: "Reject | Revise | Shortlist | Develop | Park for later"
          }
        ]
      },
      evaluation_mode: input.evaluationMode,
      evaluation_mode_guidance: modeGuidance[input.evaluationMode],
      scoring_dimensions: {
        strategic_fit: "connects to objective, audience tension, category pressure, and dossier",
        originality: "meaningfully fresh versus familiar category idea",
        brand_product_truth: "dramatizes real proof, product truth, service truth, or credible brand role",
        source_grounding: "supported by context versus mostly assumption",
        audience_tension: "touches real human, buyer, cultural, or organizational tension",
        execution_potential: "can travel into visible formats or campaign assets",
        feasibility: "operationally possible, budget-sensitive, legal or proof risk",
        genericness_risk: "could competitors comfortably run the same idea",
        bravery_fit: "matches the selected bravery level",
        development_potential: "worth turning into a route later"
      },
      project: input.project,
      ideas: input.ideas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        one_line_idea: idea.one_line_idea,
        core_collision: idea.core_collision,
        audience_tension: idea.audience_tension,
        product_truth: idea.product_truth,
        execution_format: idea.execution_format,
        why_it_may_work: idea.why_it_may_work,
        non_generic_reason: idea.non_generic_reason,
        risk_watchout: idea.risk_watchout,
        source_grounding_note: idea.source_grounding_note,
        assumptions: idea.assumptions,
        bravery_level: idea.bravery_level,
        status: idea.status
      })),
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

export interface ParsedIdeaEvaluation {
  idea_card_id: string;
  overall_verdict: string;
  strongest_aspect: string;
  weakest_aspect: string;
  scores_json: Record<EvaluationDimensionKey, number>;
  overall_sharpness_score: number;
  genericness_risk_score: number;
  development_readiness: "Low" | "Medium" | "High";
  source_grounding_assessment: string;
  unsupported_claims: string[];
  feasibility_risks: string[];
  sharpness_suggestions: string[];
  recommended_action: EvaluationRecommendedAction;
}

function integerInRange(value: unknown, min: number, max: number, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`Invalid evaluation score: ${label}`);
  }
  return number;
}

function requiredString(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Missing evaluation field: ${label}`);
  return text;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

export function parseIdeaEvaluationJson(raw: string, expectedIdeaIds: string[]) {
  const stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(stripped) as { evaluations?: Array<Record<string, unknown>> };
  if (!Array.isArray(parsed.evaluations)) {
    throw new Error("Model output did not include evaluations");
  }

  const expected = new Set(expectedIdeaIds);
  const seen = new Set<string>();
  const evaluations: ParsedIdeaEvaluation[] = [];

  for (const item of parsed.evaluations) {
    const ideaCardId = requiredString(item.idea_card_id, "idea_card_id");
    if (!expected.has(ideaCardId) || seen.has(ideaCardId)) continue;
    seen.add(ideaCardId);

    const scoresSource = (item.scores ?? {}) as Record<string, unknown>;
    const scores = Object.fromEntries(
      dimensionKeys.map((key) => [key, integerInRange(scoresSource[key], 1, 5, key)])
    ) as Record<EvaluationDimensionKey, number>;

    const developmentReadiness = requiredString(
      item.development_readiness,
      "development_readiness"
    );
    if (!["Low", "Medium", "High"].includes(developmentReadiness)) {
      throw new Error("Invalid development readiness");
    }

    const recommendedAction = requiredString(item.recommended_action, "recommended_action");
    if (!recommendedActions.includes(recommendedAction as EvaluationRecommendedAction)) {
      throw new Error("Invalid recommended action");
    }

    evaluations.push({
      idea_card_id: ideaCardId,
      overall_verdict: requiredString(item.overall_verdict, "overall_verdict"),
      strongest_aspect: requiredString(item.strongest_aspect, "strongest_aspect"),
      weakest_aspect: requiredString(item.weakest_aspect, "weakest_aspect"),
      scores_json: scores,
      overall_sharpness_score: integerInRange(
        item.overall_sharpness_score,
        1,
        10,
        "overall_sharpness_score"
      ),
      genericness_risk_score: integerInRange(
        item.genericness_risk_score,
        1,
        10,
        "genericness_risk_score"
      ),
      development_readiness: developmentReadiness as "Low" | "Medium" | "High",
      source_grounding_assessment: requiredString(
        item.source_grounding_assessment,
        "source_grounding_assessment"
      ),
      unsupported_claims: stringArray(item.unsupported_claims),
      feasibility_risks: stringArray(item.feasibility_risks),
      sharpness_suggestions: stringArray(item.sharpness_suggestions),
      recommended_action: recommendedAction as EvaluationRecommendedAction
    });
  }

  if (evaluations.length !== expectedIdeaIds.length) {
    throw new Error("Model output did not evaluate every requested idea");
  }

  return evaluations;
}
