import type {
  BraveryLevel,
  ContextPack,
  IdeationGenerateInput,
  ProjectDossier
} from "@momentum-lab/shared";

const braveryGuidance: Record<BraveryLevel, string> = {
  Safe: "Presentable, realistic, low-risk, but still specific and non-generic.",
  Sharp: "Strategically strong, fresh, realistic, and useful as the default Momentum Lab mode.",
  Bold: "Push category norms with stronger hooks, sharper tension, and more visible creative devices.",
  Wild: "Prioritise novelty, provocation, spectacle, and unusual combinations; flag feasibility risks separately.",
  "Chaos first": "Raw, strange, high-variance thought starters. Do not polish them. Evaluation comes later."
};

export function buildIdeationPrompt(input: {
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
  contextPack: ContextPack;
  dossier: ProjectDossier | null;
  ideation: Required<Pick<IdeationGenerateInput, "query" | "bravery_level" | "idea_count">> &
    Pick<IdeationGenerateInput, "user_instruction">;
}) {
  const system = [
    "You are Momentum Lab's first-pass ideation engine.",
    "Generate rough creative thought-starter cards, not polished campaign routes.",
    "Use only the supplied project metadata, stored dossier, and context pack.",
    "Do not invent statistics, performance claims, legal claims, current events, competitor facts, or product facts.",
    "Mandatory rule sources must be followed. Inspiration sources are stimulus only and must not be copied or treated as proof. Context sources are background, not strict rules. Evaluation sources should flag risks and genericness. Strategy sources sharpen the problem and tension.",
    "Avoid generic marketing language like empower, transform, unlock potential, elevate, or vague purpose language.",
    "Encourage collision, inversion, provocation, category-breaking routes, cultural mashups, old mechanics in new categories, unusual formats, tension, and spectacle where the bravery level allows it.",
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
        ideas: [
          {
            title: "short idea title",
            one_line_idea: "one sentence only",
            core_collision: "what is being collided",
            audience_tension: "audience tension",
            product_truth: "grounded product or brand truth, or labelled assumption",
            execution_format: "possible format",
            why_it_may_work: "why it may work",
            non_generic_reason: "what makes it less generic",
            risk_watchout: "risk or watchout",
            source_grounding_note: "brief note naming the type of source grounding",
            assumptions: ["explicit assumptions only"]
          }
        ]
      },
      idea_count: input.ideation.idea_count,
      bravery_level: input.ideation.bravery_level,
      bravery_guidance: braveryGuidance[input.ideation.bravery_level],
      task_query: input.ideation.query,
      user_instruction: input.ideation.user_instruction ?? null,
      project: input.project,
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

export interface ParsedIdeaCard {
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
}

const requiredIdeaFields = [
  "title",
  "one_line_idea",
  "core_collision",
  "audience_tension",
  "product_truth",
  "execution_format",
  "why_it_may_work",
  "non_generic_reason",
  "risk_watchout",
  "source_grounding_note"
] as const;

export function parseIdeationJson(raw: string, requestedCount: number) {
  const stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(stripped) as { ideas?: Array<Record<string, unknown>> };
  if (!Array.isArray(parsed.ideas)) {
    throw new Error("Model output did not include idea cards");
  }

  const seenTitles = new Set<string>();
  const ideas: ParsedIdeaCard[] = [];
  for (const item of parsed.ideas) {
    const normalized: Record<string, string> = {};
    for (const field of requiredIdeaFields) {
      const value = String(item[field] ?? "").trim();
      if (!value) throw new Error("Model output included an incomplete idea card");
      normalized[field] = value;
    }
    const titleKey = normalized.title.toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    ideas.push({
      title: normalized.title,
      one_line_idea: normalized.one_line_idea,
      core_collision: normalized.core_collision,
      audience_tension: normalized.audience_tension,
      product_truth: normalized.product_truth,
      execution_format: normalized.execution_format,
      why_it_may_work: normalized.why_it_may_work,
      non_generic_reason: normalized.non_generic_reason,
      risk_watchout: normalized.risk_watchout,
      source_grounding_note: normalized.source_grounding_note,
      assumptions: Array.isArray(item.assumptions)
        ? item.assumptions.map(String).filter(Boolean).slice(0, 5)
        : []
    });
    if (ideas.length >= requestedCount) break;
  }

  if (!ideas.length) {
    throw new Error("Model output did not include usable idea cards");
  }
  return ideas;
}
