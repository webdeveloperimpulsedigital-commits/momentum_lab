import { config } from "./config.js";
import { LlmError } from "./llm.js";
import { selectModelRoute, type ModelMode } from "./modelRouter.js";
import type { ResearchDepth } from "@momentum-lab/shared";

export interface LiveWebSource {
  title: string | null;
  url: string;
  start_index: number | null;
  end_index: number | null;
  cited_text: string | null;
}

export interface LiveWebResearchResult {
  query: string;
  research_depth: ResearchDepth;
  mode_label: ModelMode;
  summary: string;
  sources: LiveWebSource[];
  model_provider: string;
  model_name: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
  latency_ms: number;
  raw_response_id: string | null;
}

type ResponseOutputContent = {
  type?: string;
  text?: string;
  annotations?: Array<{
    type?: string;
    url?: string;
    title?: string;
    start_index?: number;
    end_index?: number;
    url_citation?: {
      url?: string;
      title?: string;
      start_index?: number;
      end_index?: number;
    };
  }>;
};

type ResponseOutputItem = {
  type?: string;
  content?: ResponseOutputContent[];
};

type ResponseBody = {
  id?: string;
  output_text?: string;
  output?: ResponseOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export async function runLiveWebResearch(input: {
  query: string;
  projectContext: string;
  researchDepth: ResearchDepth;
  modelMode?: ModelMode;
  allowedDomains?: string[];
}): Promise<LiveWebResearchResult> {
  if (config.llmProvider !== "openai") {
    throw new LlmError("Live web research requires the OpenAI provider");
  }
  if (!config.openaiApiKey) {
    throw new LlmError("OpenAI API key is not configured for live web research");
  }

  const route = selectModelRoute({
    content: input.query,
    requestedMode: input.modelMode,
    purpose: "live_web_research"
  });
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(config.llmTimeoutMs, 60000));
  const searchContextSize = depthToSearchContextSize(input.researchDepth);
  const prompt = [
    "You are Momentum Lab's live web research layer.",
    "Run live web search before answering. Do not answer from memory alone.",
    "Return a concise creative intelligence research brief, not a long report.",
    "Label uncertain claims with [DATA POINT TO BE CONFIRMED], [CLAIM REQUIRES SOURCE], or [UNVERIFIED].",
    "Separate inspiration, proof, risks, and opportunities.",
    "Project context:",
    input.projectContext || "[ASSUMPTION] No project context has been provided yet.",
    "",
    `Research depth: ${input.researchDepth}`,
    `Research task: ${input.query}`
  ].join("\n");

  const tool: Record<string, unknown> = {
    type: "web_search",
    search_context_size: searchContextSize
  };
  if (input.allowedDomains?.length) {
    tool.filters = { allowed_domains: input.allowedDomains };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: route.model,
        input: prompt,
        tools: [tool],
        tool_choice: "required",
        temperature: route.temperature,
        max_output_tokens: route.maxOutputTokens
      }),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as ResponseBody & {
      error?: { message?: string };
    };
    if (!response.ok) {
      console.warn(
        JSON.stringify({
          event: "live_web_research_failed",
          status: response.status,
          model: route.model,
          research_depth: input.researchDepth,
          elapsed_ms: Date.now() - startedAt,
          message: body.error?.message
        })
      );
      throw new LlmError(body.error?.message || "Live web search failed");
    }

    const summary = extractText(body);
    const sources = extractSources(body, summary);
    if (!summary.trim()) {
      throw new LlmError("Live web search returned an empty response");
    }
    if (!sources.length) {
      throw new LlmError("Live web search completed without source citations");
    }

    console.info(
      JSON.stringify({
        event: "live_web_research_success",
        model: route.model,
        mode: route.mode,
        research_depth: input.researchDepth,
        source_count: sources.length,
        elapsed_ms: Date.now() - startedAt,
        usage: body.usage ?? null
      })
    );

    return {
      query: input.query,
      research_depth: input.researchDepth,
      mode_label: route.mode,
      summary,
      sources,
      model_provider: route.provider,
      model_name: route.model,
      usage: body.usage ?? null,
      latency_ms: Date.now() - startedAt,
      raw_response_id: body.id ?? null
    };
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LlmError("Live web search timed out");
    }
    throw new LlmError(error instanceof Error ? error.message : "Live web search failed");
  } finally {
    clearTimeout(timeout);
  }
}

function depthToSearchContextSize(depth: ResearchDepth) {
  if (depth === "Light") return "low";
  if (depth === "Deep") return "high";
  return "medium";
}

function extractText(body: ResponseBody) {
  if (typeof body.output_text === "string") return body.output_text;
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}

function extractSources(body: ResponseBody, summary: string): LiveWebSource[] {
  const seen = new Set<string>();
  const sources: LiveWebSource[] = [];
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        const citation = annotation.url_citation ?? annotation;
        const url = citation.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const start = typeof citation.start_index === "number" ? citation.start_index : null;
        const end = typeof citation.end_index === "number" ? citation.end_index : null;
        sources.push({
          title: citation.title ?? null,
          url,
          start_index: start,
          end_index: end,
          cited_text:
            start !== null && end !== null && end > start
              ? summary.slice(start, Math.min(end, summary.length))
              : null
        });
      }
    }
  }
  return sources;
}
