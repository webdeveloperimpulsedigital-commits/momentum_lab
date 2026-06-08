import type { ContextPack, DossierSection } from "@momentum-lab/shared";

export const dossierSectionTitles = [
  ["client_need", "What the client seems to need"],
  ["category_repetition", "What the category keeps repeating"],
  ["audience_feeling", "What the audience may be feeling or avoiding"],
  ["market_forces", "What cultural or market forces matter now"],
  ["moments_or_events", "What moments, dates, or events may be usable"],
  ["borrowable_mechanics", "What old or unrelated campaign mechanics may be worth borrowing"],
  ["proof_or_product_truth", "What proof or product truth can be dramatized"],
  ["category_boredom", "Where the category is boring"],
  ["disruption_opportunity", "Where the opportunity for disruption sits"],
  ["assumptions", "What assumptions are being made"],
  ["missing_context", "What context is missing or weak"],
  ["clarifications", "What should be clarified before ideation"]
] as const;

export function emptyDossierSections() {
  return dossierSectionTitles.map(([key, title]) => ({
    key,
    title,
    content: []
  })) as DossierSection[];
}

export function buildDossierPrompt(input: {
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
}) {
  const system = [
    "You are Momentum Lab's grounded Creative Intelligence Dossier writer.",
    "Use only the supplied project metadata and context pack.",
    "Do not invent client facts, performance numbers, statistics, market data, legal claims, competitor claims, dates, current events, or case details.",
    "If something is not grounded in the context, label it as an assumption or missing context.",
    "Mandatory rule sources are hard constraints. Inspiration sources are creative stimulus only, not proof. Context sources are background, not strict instructions. Evaluation sources are critique criteria. Strategy sources are framing intelligence.",
    "Keep the dossier concise, sharp, and useful before ideation. Avoid generic marketing language.",
    "Return strict JSON only."
  ].join("\n");

  const context = input.contextPack.sections.map((section) => ({
    title: section.title,
    role: section.role,
    chunks: section.chunks.map((chunk) => ({
      source_title: chunk.source_title,
      source_role: chunk.source_role,
      source_type: chunk.source_type,
      source_scope: chunk.source_scope,
      snippet: chunk.snippet,
      similarity: chunk.similarity
    }))
  }));

  const user = JSON.stringify(
    {
      required_json_shape: {
        sections: dossierSectionTitles.map(([key, title]) => ({
          key,
          title,
          content: ["1-3 concise bullets"]
        })),
        assumptions: ["explicit assumptions only"],
        missing_context: ["missing or weak evidence only"]
      },
      project: input.project,
      context_pack_summary: {
        query: input.contextPack.query,
        retrieval_scope: input.contextPack.retrieval_scope,
        retrieval_mode: input.contextPack.retrieval_mode,
        mandatory_rules_found: input.contextPack.mandatory_rules_found,
        missing_or_unavailable_context: input.contextPack.missing_or_unavailable_context
      },
      grouped_context: context
    },
    null,
    2
  );

  return { system, user };
}

export function parseDossierJson(raw: string) {
  const stripped = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(stripped) as {
    sections?: DossierSection[];
    assumptions?: string[];
    missing_context?: string[];
  };
  const sections = emptyDossierSections().map((expected) => {
    const section = parsed.sections?.find((item) => item.key === expected.key);
    return {
      ...expected,
      content: Array.isArray(section?.content)
        ? section.content.map(String).filter(Boolean).slice(0, 4)
        : []
    };
  });
  return {
    sections,
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map(String).filter(Boolean).slice(0, 8)
      : [],
    missing_context: Array.isArray(parsed.missing_context)
      ? parsed.missing_context.map(String).filter(Boolean).slice(0, 8)
      : []
  };
}
