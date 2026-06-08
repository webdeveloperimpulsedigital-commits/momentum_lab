import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env")
].filter((path, index, paths) => paths.indexOf(path) === index && existsSync(path));

for (const path of envPaths) {
  dotenv.config({ path, override: false });
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  authSecret: process.env.AUTH_SECRET ?? "development-only-change-me",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@momentum.local",
  adminPassword: process.env.ADMIN_PASSWORD ?? "password",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingProvider: process.env.EMBEDDING_PROVIDER ?? "openai",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  embeddingBatchSize: Number(process.env.EMBEDDING_BATCH_SIZE ?? 32),
  embeddingTimeoutMs: Number(process.env.EMBEDDING_TIMEOUT_MS ?? 30000),
  llmProvider: process.env.LLM_PROVIDER ?? "openai",
  llmModel: process.env.LLM_MODEL ?? "gpt-4.1-mini",
  llmTemperature: Number(process.env.LLM_TEMPERATURE ?? 0.7),
  llmMaxOutputTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 1400),
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 45000)
};

export const hasSupabaseAuth =
  Boolean(config.supabaseUrl) && Boolean(config.supabaseAnonKey);

export const hasSupabaseDatabase =
  Boolean(config.supabaseUrl) && Boolean(config.supabaseServiceRoleKey);

export const runtimeStatus = {
  supabaseConfigured: hasSupabaseAuth && hasSupabaseDatabase,
  supabaseAuthConfigured: hasSupabaseAuth,
  supabaseDatabaseConfigured: hasSupabaseDatabase,
  storageMode: hasSupabaseDatabase ? "supabase" : "memory",
  authMode: hasSupabaseAuth ? "supabase-auth" : "local-placeholder"
} as const;
