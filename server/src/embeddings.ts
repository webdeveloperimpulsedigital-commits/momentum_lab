import { config } from "./config.js";

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export function hasEmbeddingProviderKey() {
  return Boolean(config.openaiApiKey);
}

export function embeddingSettings() {
  return {
    provider: config.embeddingProvider,
    model: config.embeddingModel,
    dimensions: config.embeddingDimensions,
    batchSize: config.embeddingBatchSize
  };
}

export async function embedTexts(texts: string[]) {
  if (config.embeddingProvider !== "openai") {
    throw new EmbeddingError("Unsupported embedding provider");
  }
  if (!config.openaiApiKey) {
    throw new EmbeddingError("Embedding provider key is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.embeddingTimeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: texts,
        dimensions: config.embeddingDimensions
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new EmbeddingError("Embedding provider rejected the configured key");
      }
      if (response.status === 429) {
        throw new EmbeddingError("Embedding provider rate limit reached");
      }
      throw new EmbeddingError("Embedding provider request failed");
    }

    const body = (await response.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const vectors = (body.data ?? [])
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    if (vectors.length !== texts.length) {
      throw new EmbeddingError("Embedding provider returned an unexpected response");
    }
    if (vectors.some((vector) => vector.length !== config.embeddingDimensions)) {
      throw new EmbeddingError("Embedding dimension mismatch");
    }

    return vectors;
  } catch (error) {
    if (error instanceof EmbeddingError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new EmbeddingError("Embedding provider request timed out");
    }
    throw new EmbeddingError("Embedding provider request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export function vectorLiteral(vector: number[]) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
