import { config } from "./config.js";

export type ModelMode = "Cost saver" | "Default" | "Deep" | "Premium" | "Chaos";

export interface ModelRoute {
  mode: ModelMode;
  provider: "openai";
  model: string;
  temperature: number;
  maxOutputTokens: number;
  reason: string;
}

export function inferModelMode(input: {
  content?: string;
  requestedMode?: ModelMode;
  purpose?: string;
}): ModelMode {
  if (input.requestedMode) return input.requestedMode;
  const text = `${input.purpose ?? ""} ${input.content ?? ""}`.toLowerCase();

  if (/\b(chaos|strange|wildest|highest variance|unfiltered)\b/.test(text)) return "Chaos";
  if (/\b(deep|major pitch|exhaustive|high-value|full research)\b/.test(text)) return "Deep";
  if (/\b(premium|client-ready|final|board|leadership)\b/.test(text)) return "Premium";
  if (/\b(light|quick|cheap|cost saver|low cost)\b/.test(text)) return "Cost saver";
  return "Default";
}

export function selectModelRoute(input: {
  content?: string;
  requestedMode?: ModelMode;
  purpose: string;
}): ModelRoute {
  const mode = inferModelMode(input);
  const route: ModelRoute = {
    mode,
    provider: "openai",
    model: config.llmModel,
    temperature:
      mode === "Chaos" ? Math.min(1.1, Math.max(config.llmTemperature, 0.95)) : config.llmTemperature,
    maxOutputTokens:
      mode === "Deep" || mode === "Premium"
        ? Math.max(config.llmMaxOutputTokens, 2200)
        : config.llmMaxOutputTokens,
    reason:
      "OpenAI is the only configured provider in this build, so operating modes are logged while the configured model is used."
  };

  console.info(
    JSON.stringify({
      event: "model_route_selected",
      purpose: input.purpose,
      mode: route.mode,
      provider: route.provider,
      model: route.model,
      reason: route.reason
    })
  );

  return route;
}
