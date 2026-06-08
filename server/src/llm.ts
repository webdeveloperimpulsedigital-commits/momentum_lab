import { config } from "./config.js";

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export function llmSettings() {
  return {
    provider: config.llmProvider,
    model: config.llmModel,
    temperature: config.llmTemperature,
    maxOutputTokens: config.llmMaxOutputTokens
  };
}

export async function generateStructuredText(input: {
  system: string;
  user: string;
  purpose: string;
}) {
  if (config.llmProvider !== "openai") {
    throw new LlmError("Unsupported LLM provider");
  }
  if (!config.openaiApiKey) {
    throw new LlmError("LLM provider key is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.llmTimeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.llmModel,
        input: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ],
        temperature: config.llmTemperature,
        max_output_tokens: config.llmMaxOutputTokens
      }),
      signal: controller.signal
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new LlmError("LLM provider rejected the configured key");
      }
      if (response.status === 429) {
        throw new LlmError("LLM provider rate limit reached");
      }
      throw new LlmError("LLM provider request failed");
    }

    const text =
      typeof body.output_text === "string"
        ? body.output_text
        : Array.isArray(body.output)
          ? body.output
              .flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
              .map((content: { text?: string }) => content.text ?? "")
              .join("")
          : "";

    if (!text.trim()) {
      throw new LlmError("LLM provider returned an empty response");
    }

    return {
      text,
      provider: config.llmProvider,
      model: config.llmModel,
      usage: body.usage
        ? {
            input_tokens: body.usage.input_tokens,
            output_tokens: body.usage.output_tokens,
            total_tokens: body.usage.total_tokens
          }
        : null
    };
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LlmError("LLM provider request timed out");
    }
    throw new LlmError("LLM provider request failed");
  } finally {
    clearTimeout(timeout);
  }
}
