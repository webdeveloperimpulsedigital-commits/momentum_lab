import crypto from "node:crypto";
import { BRAVERY_LEVELS, SOURCE_ROLE_VALUES } from "@momentum-lab/shared";
import type {
  Project,
  ProjectCreateInput,
  ProjectMessage,
  ProjectNote,
  ProjectWorkspaceData,
  RejectedIdea,
  ShortlistedIdea,
  DevelopedRoute,
  FinalCampaignTruth,
  FinalRouteSelectionInput,
  GlobalSource,
  ProjectSource,
  SourceInput,
  SourceContentSummary,
  SourceChunk,
  ContextPack,
  CampaignBlueprint,
  CampaignBlueprintGenerateInput,
  CampaignBlueprintRevisionNote,
  PitchDeckHandoff,
  PitchDeckHandoffGenerateInput,
  PitchDeckHandoffRevisionNote,
  PitchDeckHandoffReview,
  PitchDeckHandoffReviewGenerateInput,
  PitchDeckHandoffReviewNote,
  PitchDeckHandoffSlideReview,
  DossierGenerateInput,
  IdeaEvaluationGenerateInput,
  IdeationGenerateInput,
  ContextPackInput,
  ContextPackChunk,
  ContextPackSection,
  ContextPackScope,
  ProjectDossier,
  ProjectIdeaCard,
  ProjectIdeaEvaluation,
  ProjectIdeationRun,
  RouteDevelopInput,
  RouteRevisionNote,
  SourceSearchInput,
  SourceSearchResult,
  SourceRoleValue,
  SourceType,
  ResearchDepth,
  BraveryLevel,
  Settings,
  SettingsPatchInput
} from "@momentum-lab/shared";
import { supabaseAdminClient } from "./supabase.js";
import { sanitizeFileName } from "./uploads.js";
import { chunkText, extractSourceText, wordCount } from "./processing.js";
import { embedTexts, embeddingSettings, vectorLiteral } from "./embeddings.js";
import { runLiveWebResearch, type LiveWebResearchResult } from "./liveResearch.js";
import { buildDossierPrompt, parseDossierJson } from "./dossierPrompt.js";
import { buildIdeationPrompt, parseIdeationJson } from "./ideationPrompt.js";
import { buildIdeaEvaluationPrompt, parseIdeaEvaluationJson } from "./evaluationPrompt.js";
import { buildRouteDevelopmentPrompt, parseRouteDevelopmentJson } from "./routePrompt.js";
import { buildCampaignBlueprintPrompt, parseCampaignBlueprintJson } from "./blueprintPrompt.js";
import { buildPitchDeckHandoffPrompt, parsePitchDeckHandoffJson } from "./handoffPrompt.js";
import {
  buildPitchDeckHandoffReviewPrompt,
  fallbackPitchDeckHandoffReview,
  parsePitchDeckHandoffReviewJson
} from "./handoffReviewPrompt.js";
import { generateStructuredText, llmSettings } from "./llm.js";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const emptyToNull = (value?: string) => (value && value.trim() ? value.trim() : null);

const memoryProjects = new Map<string, Project>();
const memoryMessages = new Map<string, ProjectMessage[]>();
const fallbackSettings: Settings = {
  id: "default",
  default_model_mode: "Balanced",
  default_research_depth: "Standard",
  default_bravery_level: "Sharp",
  monthly_usage_warning_level: 80,
  active_model_providers: [],
  created_at: now(),
  updated_at: now()
};
let memorySettings = fallbackSettings;

function createMemoryProject(userId: string, input: ProjectCreateInput): Project {
  const timestamp = now();
  return {
    id: id(),
    user_id: userId,
    project_name: input.project_name.trim(),
    client_name: emptyToNull(input.client_name),
    category: emptyToNull(input.category),
    market: emptyToNull(input.market),
    audience: emptyToNull(input.audience),
    objective: emptyToNull(input.objective),
    known_constraints: emptyToNull(input.known_constraints),
    bravery_level: input.bravery_level ?? "Sharp",
    default_model_mode: "Balanced",
    default_research_depth: "Standard",
    research_depth: input.research_depth ?? "Standard",
    desired_output_type: emptyToNull(input.desired_output_type),
    status: input.status ?? "Draft",
    brief_notes: emptyToNull(input.brief_notes),
    current_stage: "Intake",
    created_at: timestamp,
    updated_at: timestamp
  };
}

export async function listProjects(userId: string) {
  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Project[];
  }

  return [...memoryProjects.values()]
    .filter((project) => project.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createProject(userId: string, input: ProjectCreateInput) {
  const project = createMemoryProject(userId, input);

  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("projects")
      .insert(project)
      .select("*")
      .single();

    if (error) throw error;
    return data as Project;
  }

  memoryProjects.set(project.id, project);
  memoryMessages.set(project.id, [
    {
      id: id(),
      project_id: project.id,
      role: "assistant",
      content:
        "Project Workspace initialized. Add client context, upload files, or ask me to browse live web before ideation.",
      message_type: "normal_chat",
      model_used: null,
      created_at: project.created_at
    }
  ]);
  return project;
}

export async function getProject(userId: string, projectId: string) {
  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data as Project;
  }

  const project = memoryProjects.get(projectId);
  return project?.user_id === userId ? project : null;
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<Project>
) {
  const existing = await getProject(userId, projectId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...patch,
    updated_at: now()
  };

  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("projects")
      .update(next)
      .eq("id", projectId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data as Project;
  }

  memoryProjects.set(projectId, next);
  return next;
}

export async function deleteProject(userId: string, projectId: string) {
  const existing = await getProject(userId, projectId);
  if (!existing) return false;

  if (supabaseAdminClient) {
    const { data: projectSourceFiles, error: sourceFileError } = await supabaseAdminClient
      .from("project_sources")
      .select("storage_bucket, storage_path")
      .eq("project_id", projectId)
      .not("storage_path", "is", null);
    if (sourceFileError) throw sourceFileError;

    const storagePathsByBucket = new Map<string, string[]>();
    for (const source of projectSourceFiles ?? []) {
      if (!source.storage_bucket || !source.storage_path) continue;
      storagePathsByBucket.set(source.storage_bucket, [
        ...(storagePathsByBucket.get(source.storage_bucket) ?? []),
        source.storage_path
      ]);
    }

    const { error } = await supabaseAdminClient
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", userId);

    if (error) throw error;

    for (const [bucket, paths] of storagePathsByBucket) {
      const { error: storageError } = await supabaseAdminClient.storage
        .from(bucket)
        .remove(paths);
      if (storageError) {
        console.warn(
          JSON.stringify({
            event: "project_storage_cleanup_failed",
            project_id: projectId,
            bucket,
            path_count: paths.length,
            message: storageError.message
          })
        );
      }
    }

    return true;
  }

  memoryProjects.delete(projectId);
  memoryMessages.delete(projectId);
  return true;
}

export async function listMessages(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  if (!project) return null;

  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("project_messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProjectMessage[];
  }

  return memoryMessages.get(projectId) ?? [];
}

export async function createMessagePair(
  userId: string,
  projectId: string,
  content: string
) {
  const project = await getProject(userId, projectId);
  if (!project) return null;

  const timestamp = now();
  const userMessage: ProjectMessage = {
    id: id(),
    project_id: projectId,
    role: "user",
    content,
    message_type: "normal_chat",
    model_used: null,
    created_at: timestamp
  };

  if (supabaseAdminClient) {
    const { error: userError } = await supabaseAdminClient
      .from("project_messages")
      .insert(userMessage);

    if (userError) throw userError;

    const assistantMessage = await createAssistantMessageForChat(userId, project, content);
    const { data, error } = await supabaseAdminClient
      .from("project_messages")
      .insert(assistantMessage)
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    await updateProject(userId, projectId, {});
    return [userMessage, ...((data ?? []) as ProjectMessage[])];
  }

  const assistantMessage = await createAssistantMessageForChat(userId, project, content);
  const messages = memoryMessages.get(projectId) ?? [];
  messages.push(userMessage, assistantMessage);
  memoryMessages.set(projectId, messages);
  memoryProjects.set(projectId, { ...project, updated_at: now() });
  return [userMessage, assistantMessage];
}

async function createAssistantMessageForChat(
  userId: string,
  project: Project,
  content: string
): Promise<ProjectMessage> {
  try {
    const response = await orchestrateProjectChat(userId, project, content);
    return {
      id: id(),
      project_id: project.id,
      role: "assistant",
      content: response.content,
      message_type: response.messageType,
      model_used: response.modelUsed,
      created_at: now()
    };
  } catch (error) {
    return {
      id: id(),
      project_id: project.id,
      role: "assistant",
      content:
        "[NOT READY FOR CLIENT]\n" +
        (error instanceof Error
          ? error.message
          : "Momentum Lab could not complete that action. Try a smaller instruction or add the missing context."),
      message_type: "normal_chat",
      model_used: null,
      created_at: now()
    };
  }
}

async function orchestrateProjectChat(
  userId: string,
  project: Project,
  content: string
): Promise<{ content: string; messageType: ProjectMessage["message_type"]; modelUsed: string | null }> {
  const command = classifyProjectChatCommand(content);
  if (command === "research") {
    return runProjectResearchFromChat(userId, project, content);
  }
  if (command === "dossier") {
    const result = await generateProjectDossier(userId, project.id, {
      query: content.slice(0, 300),
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: [...SOURCE_ROLE_VALUES],
      source_types: ["text", "markdown", "pdf", "docx", "note", "transcript", "url", "other"],
      max_total_chunks: 18,
      max_characters: 12000,
      title: "Creative Intelligence Dossier"
    });
    if (!result) {
      return {
        content:
          "[CLIENT INPUT NEEDED]\nI can build the dossier once this project has searchable source context. Upload files, add notes, or ask me to browse live web first.",
        messageType: "normal_chat",
        modelUsed: null
      };
    }
    return {
      content: formatDossierChatResponse(result.dossier),
      messageType: "research_dossier",
      modelUsed: result.dossier.model_name
    };
  }
  if (command === "ideas") {
    const bravery = inferBraveryLevel(content, project.bravery_level ?? "Sharp");
    const count = inferIdeaCount(content);
    const result = await generateProjectIdeaCards(userId, project.id, {
      query: content.slice(0, 300),
      bravery_level: bravery,
      idea_count: count,
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: [...SOURCE_ROLE_VALUES],
      source_types: ["text", "markdown", "pdf", "docx", "note", "transcript", "url", "other"],
      max_total_chunks: 18,
      max_characters: 12000,
      user_instruction: content.slice(0, 800)
    });
    if (!result) {
      return {
        content:
          "[CLIENT INPUT NEEDED]\nI can generate thought starters after there is project or global source context. Upload context or ask me to run live research first.",
        messageType: "normal_chat",
        modelUsed: null
      };
    }
    return {
      content: formatIdeasChatResponse(result.ideas),
      messageType: "thought_starters",
      modelUsed: llmSettings().model
    };
  }
  if (command === "blueprint") {
    return {
      content:
        "[CLIENT INPUT NEEDED]\nI can create the campaign blueprint once a final campaign truth is selected. Tell me which developed route is final, or use the advanced route/final truth controls below to lock it.",
      messageType: "normal_chat",
      modelUsed: null
    };
  }
  if (command === "handoff") {
    return {
      content:
        "[CLIENT INPUT NEEDED]\nI can create the pitch deck handoff after there is a campaign blueprint. If the blueprint exists, tell me which one to use.",
      messageType: "normal_chat",
      modelUsed: null
    };
  }

  return {
    content: [
      "I’m ready. Give me client context, upload files, or ask for the next creative move.",
      "",
      "Useful next commands:",
      "- Browse the client and category before ideation.",
      "- Generate a dossier.",
      "- Give me 15 thought starters in Wild mode.",
      "- Red-team the shortlisted ideas.",
      "",
      "How brave should this round be: Safe, Sharp, Bold, Wild, or Chaos first?"
    ].join("\n"),
    messageType: "normal_chat",
    modelUsed: null
  };
}

function classifyProjectChatCommand(content: string) {
  const text = content.toLowerCase();
  if (/\b(browse|live web|web research|research|competitor|competitors|category scan|market scan|precedent|proof verification|verify|client website)\b/.test(text)) {
    return "research";
  }
  if (/\b(dossier|intelligence brief|creative intelligence)\b/.test(text)) return "dossier";
  if (/\b(thought starters?|ideas?|ideate|generate|make idea|combine|stranger|wild mode|chaos)\b/.test(text)) return "ideas";
  if (/\b(blueprint|campaign blueprint|campaign truth)\b/.test(text)) return "blueprint";
  if (/\b(handoff|pitch deck|ppt|deck review|client-readiness|client readiness)\b/.test(text)) return "handoff";
  return "chat";
}

async function runProjectResearchFromChat(
  userId: string,
  project: Project,
  content: string
): Promise<{ content: string; messageType: ProjectMessage["message_type"]; modelUsed: string | null }> {
  try {
    const research = await runLiveWebResearch({
      query: content,
      projectContext: projectContextText(project),
      researchDepth: inferResearchDepth(content, project.research_depth),
      modelMode: /\b(chaos|wild)\b/i.test(content) ? "Chaos" : undefined
    });
    const researchRunId = await persistWebResearchRun(userId, project.id, research);
    return {
      content: formatResearchChatResponse(research, researchRunId),
      messageType: "research_dossier",
      modelUsed: research.model_name
    };
  } catch (error) {
    return {
      content: [
        "[LIMITED RESEARCH: LIVE WEB SEARCH FAILED]",
        "[WEB RESEARCH FAILED]",
        error instanceof Error ? error.message : "Live web research failed.",
        "",
        "I have not replaced this with internal-only research. Add/check the OpenAI web-search capability and try again."
      ].join("\n"),
      messageType: "normal_chat",
      modelUsed: null
    };
  }
}

async function persistWebResearchRun(
  userId: string,
  projectId: string,
  research: LiveWebResearchResult
) {
  if (!supabaseAdminClient) return null;
  try {
    const { data, error } = await supabaseAdminClient
      .from("web_research_runs")
      .insert({
        project_id: projectId,
        created_by: userId,
        query: research.query,
        research_depth: research.research_depth,
        mode_label: research.mode_label,
        status: "completed",
        summary: research.summary,
        model_provider: research.model_provider,
        model_name: research.model_name,
        usage_json: research.usage,
        latency_ms: research.latency_ms
      })
      .select("id")
      .single();
    if (error) throw error;

    if (research.sources.length) {
      const sourceInsert = await supabaseAdminClient.from("web_research_sources").insert(
        research.sources.map((source) => ({
          research_run_id: data.id,
          project_id: projectId,
          title: source.title,
          url: source.url,
          start_index: source.start_index,
          end_index: source.end_index,
          cited_text: source.cited_text,
          source_kind: "url_citation"
        }))
      );
      if (sourceInsert.error) throw sourceInsert.error;
    }

    return String(data.id);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "web_research_table_persist_failed",
        project_id: projectId,
        message: error instanceof Error ? error.message : "Research table persistence failed"
      })
    );
  }

  const fallback = await createProjectSource(userId, projectId, {
    title: `Live web research - ${research.query.slice(0, 80)}`,
    description: "Fallback project-linked storage for live web research. Apply migration 017 for canonical research run/source tables.",
    source_role: "context",
    source_type: "url",
    tags: ["live_web_research", research.research_depth.toLowerCase().replace(/\s+/g, "_")],
    source_status: "active",
    source_url: research.sources[0]?.url ?? "",
    content_text: [
      research.summary,
      "",
      "Sources:",
      ...research.sources.map((source, index) => `${index + 1}. ${source.title || source.url} - ${source.url}`)
    ].join("\n")
  });
  return fallback ? `project-source:${fallback.id}` : null;
}

function projectContextText(project: Project) {
  return [
    `Project: ${project.project_name}`,
    project.client_name ? `Client: ${project.client_name}` : "[ASSUMPTION] Client name not provided.",
    project.category ? `Category: ${project.category}` : "[ASSUMPTION] Category not provided.",
    project.market ? `Market/geography: ${project.market}` : "[ASSUMPTION] Market/geography not provided.",
    project.audience ? `Audience: ${project.audience}` : "[ASSUMPTION] Audience not provided.",
    project.objective ? `Objective: ${project.objective}` : "[ASSUMPTION] Objective not provided.",
    project.known_constraints ? `Constraints: ${project.known_constraints}` : "",
    project.brief_notes ? `Notes: ${project.brief_notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function inferResearchDepth(content: string, fallback: ResearchDepth): ResearchDepth {
  if (/\blight|quick|fast\b/i.test(content)) return "Light";
  if (/\bdeep|full|major pitch|exhaustive\b/i.test(content)) return "Deep";
  if (/\bstandard|serious\b/i.test(content)) return "Standard";
  return fallback || "Standard";
}

function inferBraveryLevel(content: string, fallback: BraveryLevel): BraveryLevel {
  for (const level of BRAVERY_LEVELS) {
    if (content.toLowerCase().includes(level.toLowerCase())) return level;
  }
  return fallback || "Sharp";
}

function inferIdeaCount(content: string) {
  const match = content.match(/\b([3-9]|1[0-5])\b/);
  return match ? Number(match[1]) : 8;
}

function formatResearchChatResponse(research: LiveWebResearchResult, researchRunId: string | null) {
  return [
    `[LIVE WEB SOURCE] Live web research completed (${research.research_depth}, ${research.mode_label}).`,
    researchRunId ? `Research run: ${researchRunId}` : "[LIMITED RESEARCH] Research metadata is in memory only because Supabase is not configured.",
    "",
    research.summary,
    "",
    "Sources:",
    ...research.sources.map((source, index) => `${index + 1}. ${source.title || source.url} - ${source.url}`)
  ].join("\n");
}

function formatDossierChatResponse(dossier: ProjectDossier) {
  const sections = dossier.dossier_content.sections
    .map((section) => {
      const points = section.content.slice(0, 3).map((point) => `- ${point}`).join("\n");
      return `### ${section.title}\n${points || "- [UNVERIFIED] No content generated."}`;
    })
    .join("\n\n");
  return [
    `[PROJECT SOURCE] [GLOBAL SOURCE] ${dossier.title}`,
    `Grounding: ${dossier.grounding_metadata.context_pack_total_chunks} source chunks used.`,
    "",
    sections,
    dossier.assumptions.length ? `\n[ASSUMPTION]\n${dossier.assumptions.map((item) => `- ${item}`).join("\n")}` : "",
    dossier.missing_context.length ? `\n[CLIENT INPUT NEEDED]\n${dossier.missing_context.map((item) => `- ${item}`).join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function formatIdeasChatResponse(ideas: ProjectIdeaCard[]) {
  return [
    `Generated ${ideas.length} thought starter${ideas.length === 1 ? "" : "s"}.`,
    "",
    ...ideas.map((idea, index) =>
      [
        `${index + 1}. ${idea.title}`,
        idea.one_line_idea,
        `Collision: ${idea.core_collision}`,
        `Watchout: ${idea.risk_watchout}`,
        idea.assumptions.length ? `[ASSUMPTION] ${idea.assumptions.join("; ")}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    )
  ].join("\n\n");
}

export async function listGlobalSources() {
  if (!supabaseAdminClient) {
    return [];
  }

  const { data, error } = await supabaseAdminClient
    .from("global_sources")
    .select("*")
    .eq("source_status", "active")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as GlobalSource[];
}

export async function isAdminUser(userId: string) {
  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data?.role === "admin";
  }

  return userId === "local-admin";
}

const normalizeSource = (input: Partial<SourceInput>) => ({
  title: input.title,
  description: emptyToNull(input.description),
  source_role: input.source_role ?? "context",
  source_type: input.source_type ?? "text",
  tags: input.tags ?? [],
  source_status: input.source_status ?? "active",
  source_url: emptyToNull(input.source_url),
  content_text: emptyToNull(input.content_text)
});

export async function createGlobalSource(userId: string, input: SourceInput) {
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("global_sources")
    .insert({
      ...normalizeSource(input),
      file_name: null,
      file_type: null,
      storage_path: null
    })
    .select("*")
    .single();

  if (error) throw error;
  await runAutomaticSourcePipeline({
    userId,
    scope: "global",
    sourceId: data.id
  });
  return (await getGlobalSourceById(data.id)) ?? (data as GlobalSource);
}

async function getGlobalSourceById(sourceId: string) {
  if (!supabaseAdminClient) return null;
  const { data, error } = await supabaseAdminClient
    .from("global_sources")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  return (data as GlobalSource | null) ?? null;
}

async function processSourceRecord(input: {
  userId: string;
  scope: "global" | "project";
  sourceId: string;
  projectId?: string;
}) {
  if (!supabaseAdminClient) return null;

  const table = input.scope === "global" ? "global_sources" : "project_sources";
  const query = supabaseAdminClient.from(table).select("*").eq("id", input.sourceId);
  if (input.scope === "project") query.eq("project_id", input.projectId!);

  const { data: source, error } = await query.single();
  if (error || !source) return null;

  await supabaseAdminClient
    .from(table)
    .update({ processing_status: "processing", processing_error: null })
    .eq("id", input.sourceId);

  let fileBuffer: Buffer | undefined;
  if (source.storage_bucket && source.storage_path) {
    const download = await supabaseAdminClient.storage
      .from(source.storage_bucket)
      .download(source.storage_path);
    if (download.error) {
      await supabaseAdminClient
        .from(table)
        .update({
          processing_status: "failed",
          processing_error: "Stored file could not be read",
          processed_at: now()
        })
        .eq("id", input.sourceId);
      return null;
    }
    fileBuffer = Buffer.from(await download.data.arrayBuffer());
  }

  const extraction = await extractSourceText({
    sourceType: source.source_type,
    contentText: source.content_text,
    fileBuffer,
    mimeType: source.mime_type ?? source.file_type,
    fileName: source.file_name
  });

  const characterCount = extraction.text.length;
  const words = wordCount(extraction.text);
  const chunks = chunkText(extraction.text);

  await supabaseAdminClient.from("source_chunks").delete().match({
    source_id: input.sourceId,
    source_scope: input.scope
  });

  await supabaseAdminClient.from("source_contents").upsert({
    source_id: input.sourceId,
    source_scope: input.scope,
    project_id: input.scope === "project" ? input.projectId : null,
    extracted_text: extraction.text,
    extraction_method: extraction.method,
    character_count: characterCount,
    word_count: words,
    processed_by: input.userId
  });

  if (chunks.length) {
    const rows = chunks.map((chunk, index) => ({
      source_id: input.sourceId,
      source_scope: input.scope,
      project_id: input.scope === "project" ? input.projectId : null,
      chunk_index: index,
      chunk_text: chunk,
      character_count: chunk.length,
      token_estimate: Math.ceil(chunk.length / 4)
    }));
    const chunkInsert = await supabaseAdminClient.from("source_chunks").insert(rows);
    if (chunkInsert.error) throw chunkInsert.error;
  }

  const update = await supabaseAdminClient
    .from(table)
    .update({
      processing_status: extraction.status,
      processing_error: extraction.safeError,
      processed_at: now(),
      extracted_text_available: Boolean(extraction.text),
      extracted_character_count: characterCount,
      detected_source_type: extraction.detectedType
    })
    .eq("id", input.sourceId)
    .select("*")
    .single();

  if (update.error) throw update.error;
  return update.data;
}

export async function processGlobalSource(userId: string, sourceId: string) {
  if (!(await isAdminUser(userId))) return null;
  return processSourceRecord({ userId, scope: "global", sourceId });
}

async function runAutomaticSourcePipeline(input: {
  userId: string;
  scope: "global" | "project";
  sourceId: string;
  projectId?: string;
}) {
  try {
    const processed = await processSourceRecord(input);
    if (!processed || processed.processing_status !== "processed") return;
    await embedSourceRecord({ ...input, force: false });
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "automatic_source_pipeline_failed",
        scope: input.scope,
        project_id: input.projectId,
        source_id: input.sourceId,
        message: error instanceof Error ? error.message : "Source pipeline failed"
      })
    );
  }
}

export async function createGlobalFileSource(
  userId: string,
  input: SourceInput,
  file: Express.Multer.File
) {
  if (!supabaseAdminClient) return null;

  const sourceId = id();
  const safeFileName = sanitizeFileName(file.originalname);
  const storagePath = `${sourceId}/${safeFileName}`;

  const upload = await supabaseAdminClient.storage
    .from("global-sources")
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (upload.error) throw upload.error;

  const { data, error } = await supabaseAdminClient
    .from("global_sources")
    .insert({
      id: sourceId,
      ...normalizeSource(input),
      file_name: safeFileName,
      file_type: file.mimetype,
      file_size: file.size,
      mime_type: file.mimetype,
      storage_bucket: "global-sources",
      storage_path: storagePath,
      uploaded_at: now(),
      uploaded_by: userId
    })
    .select("*")
    .single();

  if (error) throw error;
  await runAutomaticSourcePipeline({
    userId,
    scope: "global",
    sourceId
  });
  return (await getGlobalSourceById(sourceId)) ?? (data as GlobalSource);
}

export async function updateGlobalSource(sourceId: string, patch: Partial<SourceInput>) {
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("global_sources")
    .update(normalizeSource(patch))
    .eq("id", sourceId)
    .select("*")
    .single();

  if (error) return null;
  return data as GlobalSource;
}

export async function archiveGlobalSource(sourceId: string) {
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("global_sources")
    .update({ source_status: "archived" })
    .eq("id", sourceId)
    .select("*")
    .single();

  if (error) return null;
  return data as GlobalSource;
}

export async function getSettings(): Promise<Settings> {
  if (supabaseAdminClient) {
    const { data, error } = await supabaseAdminClient
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as Settings | null) ?? fallbackSettings;
  }

  return memorySettings;
}

export async function updateSettings(patch: SettingsPatchInput): Promise<Settings> {
  const existing = await getSettings();
  const next = {
    ...existing,
    ...patch,
    updated_at: now()
  };

  if (supabaseAdminClient) {
    if (existing.id === "default") {
      const { data, error } = await supabaseAdminClient
        .from("settings")
        .insert({
          default_model_mode: next.default_model_mode,
          default_research_depth: next.default_research_depth,
          default_bravery_level: next.default_bravery_level,
          monthly_usage_warning_level: next.monthly_usage_warning_level,
          active_model_providers: next.active_model_providers
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as Settings;
    }

    const { data, error } = await supabaseAdminClient
      .from("settings")
      .update({
        default_model_mode: next.default_model_mode,
        default_research_depth: next.default_research_depth,
        default_bravery_level: next.default_bravery_level,
        monthly_usage_warning_level: next.monthly_usage_warning_level,
        active_model_providers: next.active_model_providers
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data as Settings;
  }

  memorySettings = next;
  return memorySettings;
}

async function ensureProject(userId: string, projectId: string) {
  return getProject(userId, projectId);
}

export async function getProjectWorkspace(
  userId: string,
  projectId: string
): Promise<ProjectWorkspaceData | null> {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;

  if (!supabaseAdminClient) {
    return {
      notes: [],
      rejectedIdeas: [],
      shortlistedIdeas: [],
      routes: [],
      finalTruth: null,
      finalSelections: [],
      campaignBlueprints: [],
      pitchDeckHandoffs: [],
      pitchDeckHandoffReviews: [],
      pitchDeckHandoffSlideReviews: []
    };
  }

  const [notes, rejectedIdeas, shortlistedIdeas, routes, finalTruth, finalSelections, campaignBlueprints, pitchDeckHandoffs, pitchDeckHandoffReviews, pitchDeckHandoffSlideReviews] =
    await Promise.all([
      supabaseAdminClient
        .from("project_notes")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false }),
      supabaseAdminClient
        .from("rejected_ideas")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabaseAdminClient
        .from("shortlisted_ideas")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabaseAdminClient
        .from("routes")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false }),
      supabaseAdminClient
        .from("final_campaign_truths")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdminClient
        .from("final_campaign_truths")
        .select("*")
        .eq("project_id", projectId)
        .order("selected_at", { ascending: false })
      ,
      supabaseAdminClient
        .from("project_campaign_blueprints")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
      ,
      supabaseAdminClient
        .from("project_pitch_deck_handoffs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
      ,
      supabaseAdminClient
        .from("pitch_deck_handoff_reviews")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabaseAdminClient
        .from("pitch_deck_handoff_slide_reviews")
        .select("*")
        .eq("project_id", projectId)
        .order("slide_number", { ascending: true })
    ]);

  const error =
    notes.error ??
    rejectedIdeas.error ??
    shortlistedIdeas.error ??
    routes.error ??
    finalTruth.error ??
    finalSelections.error ??
    campaignBlueprints.error ??
    pitchDeckHandoffs.error ??
    pitchDeckHandoffReviews.error ??
    pitchDeckHandoffSlideReviews.error;

  if (error) throw error;

  return {
    notes: (notes.data ?? []) as ProjectNote[],
    rejectedIdeas: (rejectedIdeas.data ?? []) as RejectedIdea[],
    shortlistedIdeas: (shortlistedIdeas.data ?? []) as ShortlistedIdea[],
    routes: (routes.data ?? []) as DevelopedRoute[],
    finalTruth: (finalTruth.data as FinalCampaignTruth | null) ?? null,
    finalSelections: (finalSelections.data ?? []) as FinalCampaignTruth[],
    campaignBlueprints: (campaignBlueprints.data ?? []) as CampaignBlueprint[],
    pitchDeckHandoffs: (pitchDeckHandoffs.data ?? []) as PitchDeckHandoff[],
    pitchDeckHandoffReviews: (pitchDeckHandoffReviews.data ?? []) as PitchDeckHandoffReview[],
    pitchDeckHandoffSlideReviews: (pitchDeckHandoffSlideReviews.data ?? []) as PitchDeckHandoffSlideReview[]
  };
}

export async function createProjectNote(
  userId: string,
  projectId: string,
  content: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("project_notes")
    .insert({ project_id: projectId, content })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, {});
  return data as ProjectNote;
}

export async function updateProjectNote(
  userId: string,
  projectId: string,
  noteId: string,
  patch: { content?: string }
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("project_notes")
    .update(patch)
    .eq("id", noteId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return null;
  await updateProject(userId, projectId, {});
  return data as ProjectNote;
}

export async function deleteProjectNote(
  userId: string,
  projectId: string,
  noteId: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { error } = await supabaseAdminClient
    .from("project_notes")
    .delete()
    .eq("id", noteId)
    .eq("project_id", projectId);

  if (error) throw error;
  await updateProject(userId, projectId, {});
  return true;
}

export async function createRejectedIdea(
  userId: string,
  projectId: string,
  input: { title: string; idea_text?: string; reason_for_rejection?: string }
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("rejected_ideas")
    .insert({
      project_id: projectId,
      title: input.title,
      idea_text: emptyToNull(input.idea_text),
      reason_for_rejection: emptyToNull(input.reason_for_rejection)
    })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, { status: "Ideation" } as Partial<Project>);
  return data as RejectedIdea;
}

export async function createShortlistedIdea(
  userId: string,
  projectId: string,
  input: { title: string; idea_text?: string; why_shortlisted?: string }
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("shortlisted_ideas")
    .insert({
      project_id: projectId,
      title: input.title,
      idea_text: emptyToNull(input.idea_text),
      why_shortlisted: emptyToNull(input.why_shortlisted)
    })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, { status: "Shortlisted" } as Partial<Project>);
  return data as ShortlistedIdea;
}

export async function createDevelopedRoute(
  userId: string,
  projectId: string,
  input: {
    route_title: string;
    core_thought?: string;
    audience_tension?: string;
    brand_role?: string;
    execution_notes?: string;
    risks?: string;
  }
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("routes")
    .insert({
      project_id: projectId,
      route_name: input.route_title,
      route_title: input.route_title,
      core_thought: emptyToNull(input.core_thought),
      audience_tension: emptyToNull(input.audience_tension),
      brand_role: emptyToNull(input.brand_role),
      execution_notes: emptyToNull(input.execution_notes),
      risks: emptyToNull(input.risks),
      route_status: "developing"
    })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, { status: "Developed" } as Partial<Project>);
  return data as DevelopedRoute;
}

export async function updateDevelopedRoute(
  userId: string,
  projectId: string,
  routeId: string,
  patch: Partial<DevelopedRoute>
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const nextPatch = {
    ...patch,
    route_name: patch.route_title ?? patch.route_name
  };

  const { data, error } = await supabaseAdminClient
    .from("routes")
    .update(nextPatch)
    .eq("id", routeId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return null;
  await updateProject(userId, projectId, {});
  return data as DevelopedRoute;
}

async function getIdeaEvaluationForRoute(
  userId: string,
  projectId: string,
  ideaCardId: string,
  evaluationId?: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project || !supabaseAdminClient) return null;

  let query = supabaseAdminClient
    .from("project_idea_evaluations")
    .select("*")
    .eq("project_id", projectId)
    .eq("idea_card_id", ideaCardId);

  if (evaluationId) {
    query = query.eq("id", evaluationId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectIdeaEvaluation | null) ?? null;
}

export async function developProjectRoute(
  userId: string,
  projectId: string,
  input: RouteDevelopInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const ideas = await listIdeaCardsForEvaluation(userId, projectId, [input.idea_card_id]);
  if (!ideas) return null;
  const idea = ideas[0];

  const dossier = await getProjectDossierForIdeation(userId, projectId, input.dossier_id);
  if (input.dossier_id && !dossier) return null;

  const evaluation = await getIdeaEvaluationForRoute(
    userId,
    projectId,
    input.idea_card_id,
    input.evaluation_id
  );
  if (input.evaluation_id && !evaluation) return null;

  const routeDepth = input.route_depth ?? "Standard route";
  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    query: input.query || `Develop campaign route from idea: ${idea.title}`.slice(0, 280),
    max_total_chunks: Math.min(input.max_total_chunks ?? 18, 18),
    max_characters: Math.min(input.max_characters ?? 10000, 10000)
  });
  if (!contextPack) return null;

  const prompt = buildRouteDevelopmentPrompt({
    project,
    idea,
    evaluation,
    dossier,
    contextPack,
    routeDepth,
    userInstruction: input.user_instruction
  });
  const llmResult = await generateStructuredText({
    ...prompt,
    purpose: "developed_campaign_route"
  });

  let parsed;
  try {
    parsed = parseRouteDevelopmentJson(llmResult.text);
  } catch {
    throw new Error("Model output could not be parsed into a developed route");
  }

  const settings = llmSettings();
  const { data, error } = await supabaseAdminClient
    .from("routes")
    .insert({
      project_id: projectId,
      idea_card_id: idea.id,
      dossier_id: dossier?.id ?? null,
      evaluation_id: evaluation?.id ?? null,
      created_by: userId,
      route_depth: routeDepth,
      route_name: parsed.route_title,
      route_title: parsed.route_title,
      route_summary: parsed.route_summary,
      core_campaign_thought: parsed.core_campaign_thought,
      core_thought: parsed.core_campaign_thought,
      audience_tension: parsed.audience_tension,
      category_pressure: parsed.category_pressure,
      brand_product_truth: parsed.brand_product_truth,
      brand_role: parsed.brand_role,
      non_generic_reason: parsed.non_generic_reason,
      campaign_mechanics: parsed.campaign_mechanics,
      execution_system: parsed.execution_system,
      sample_touchpoints: parsed.sample_touchpoints,
      execution_notes: Object.values(parsed.execution_system).join("\n\n"),
      proof_needed: parsed.proof_needed.join("\n"),
      risks: parsed.risks_watchouts.join("\n"),
      risk_notes: parsed.risks_watchouts.join("\n"),
      feasibility_notes: parsed.feasibility_notes,
      source_grounding_summary: parsed.source_grounding_summary,
      assumptions: parsed.assumptions,
      missing_context: [
        ...contextPack.missing_or_unavailable_context,
        ...parsed.missing_context
      ].slice(0, 12),
      next_refinement_questions: parsed.next_refinement_questions,
      model_provider: settings.provider,
      model_name: settings.model,
      route_status: "developing"
    })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, { status: "Developed" } as Partial<Project>);
  return {
    route: data as DevelopedRoute,
    contextPack,
    usage: llmResult.usage
  };
}

export async function listRouteRevisionNotes(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("route_revision_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RouteRevisionNote[];
}

export async function createRouteRevisionNote(
  userId: string,
  projectId: string,
  routeId: string,
  note: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project || !supabaseAdminClient) return null;

  const { data: route, error: routeError } = await supabaseAdminClient
    .from("routes")
    .select("id")
    .eq("id", routeId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (routeError) throw routeError;
  if (!route) return null;

  const { data, error } = await supabaseAdminClient
    .from("route_revision_notes")
    .insert({
      project_id: projectId,
      route_id: routeId,
      created_by: userId,
      note
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as RouteRevisionNote;
}

export async function upsertFinalCampaignTruth(
  userId: string,
  projectId: string,
  input: Omit<FinalRouteSelectionInput, "developed_route_id"> & {
    developed_route_id?: string;
    route_id?: string | null;
    rationale?: string;
  }
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const developedRouteId = input.developed_route_id ?? input.route_id;
  if (!developedRouteId) return null;

  const { data: route, error: routeError } = await supabaseAdminClient
    .from("routes")
    .select("*")
    .eq("id", developedRouteId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (routeError) throw routeError;
  if (!route) return null;
  const selectedRoute = route as DevelopedRoute;

  const existing = await supabaseAdminClient
    .from("final_campaign_truths")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const payload = {
    project_id: projectId,
    route_id: developedRouteId,
    developed_route_id: developedRouteId,
    idea_card_id: input.idea_card_id ?? selectedRoute.idea_card_id ?? null,
    evaluation_id: input.evaluation_id ?? selectedRoute.evaluation_id ?? null,
    dossier_id: input.dossier_id ?? selectedRoute.dossier_id ?? null,
    selected_by: userId,
    final_route_title: input.final_route_title.trim(),
    final_campaign_truth: input.final_campaign_truth.trim(),
    rationale: emptyToNull(input.rationale ?? input.selection_rationale),
    selection_rationale: input.selection_rationale.trim(),
    why_this_route_won: emptyToNull(input.why_this_route_won),
    rejected_or_deprioritised_notes: emptyToNull(input.rejected_or_deprioritised_notes),
    proof_required: emptyToNull(input.proof_required ?? selectedRoute.proof_needed ?? undefined),
    risks_watchouts: emptyToNull(input.risks_watchouts ?? selectedRoute.risks ?? selectedRoute.risk_notes ?? undefined),
    assumptions: emptyToNull(input.assumptions ?? selectedRoute.assumptions?.join("\n")),
    missing_context: emptyToNull(input.missing_context ?? selectedRoute.missing_context?.join("\n")),
    next_action: input.next_action.trim(),
    is_active: true,
    status: "active",
    selected_at: now()
  };

  if (existing.data) {
    const { error: supersedeError } = await supabaseAdminClient
      .from("final_campaign_truths")
      .update({ is_active: false, status: "superseded" })
      .eq("id", existing.data.id);
    if (supersedeError) throw supersedeError;
  }

  const { data, error } = await supabaseAdminClient
    .from("final_campaign_truths")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  if (existing.data) {
    const { error: linkError } = await supabaseAdminClient
      .from("final_campaign_truths")
      .update({ superseded_by: data.id })
      .eq("id", existing.data.id);
    if (linkError) throw linkError;
  }
  await updateProject(userId, projectId, { status: "Finalised" } as Partial<Project>);
  return data as FinalCampaignTruth;
}

async function getFinalSelectionForBlueprint(
  projectId: string,
  finalSelectionId?: string
) {
  let query = supabaseAdminClient!
    .from("final_campaign_truths")
    .select("*")
    .eq("project_id", projectId);
  query = finalSelectionId ? query.eq("id", finalSelectionId) : query.eq("is_active", true);
  const { data, error } = await query.order("selected_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as FinalCampaignTruth | null) ?? null;
}

export async function listCampaignBlueprintRevisionNotes(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("campaign_blueprint_revision_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CampaignBlueprintRevisionNote[];
}

export async function createCampaignBlueprintRevisionNote(
  userId: string,
  projectId: string,
  blueprintId: string,
  note: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project || !supabaseAdminClient) return null;

  const { data: blueprint, error: blueprintError } = await supabaseAdminClient
    .from("project_campaign_blueprints")
    .select("id")
    .eq("id", blueprintId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (blueprintError) throw blueprintError;
  if (!blueprint) return null;

  const { data, error } = await supabaseAdminClient
    .from("campaign_blueprint_revision_notes")
    .insert({
      project_id: projectId,
      blueprint_id: blueprintId,
      created_by: userId,
      note
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CampaignBlueprintRevisionNote;
}

export async function generateCampaignBlueprint(
  userId: string,
  projectId: string,
  input: CampaignBlueprintGenerateInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const finalSelection = await getFinalSelectionForBlueprint(projectId, input.final_selection_id);
  if (!finalSelection?.final_campaign_truth) return null;

  const developedRouteId = input.developed_route_id ?? finalSelection.developed_route_id ?? finalSelection.route_id;
  if (!developedRouteId) return null;

  const { data: routeData, error: routeError } = await supabaseAdminClient
    .from("routes")
    .select("*")
    .eq("id", developedRouteId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (routeError) throw routeError;
  if (!routeData) return null;
  const route = routeData as DevelopedRoute;

  const dossierId = input.dossier_id ?? finalSelection.dossier_id ?? route.dossier_id ?? undefined;
  const evaluationId = input.evaluation_id ?? finalSelection.evaluation_id ?? route.evaluation_id ?? undefined;
  const ideaCardId = input.idea_card_id ?? finalSelection.idea_card_id ?? route.idea_card_id ?? undefined;

  const dossier = await getProjectDossierForIdeation(userId, projectId, dossierId);
  if (dossierId && !dossier) return null;

  let evaluation: ProjectIdeaEvaluation | null = null;
  if (evaluationId) {
    const { data, error } = await supabaseAdminClient
      .from("project_idea_evaluations")
      .select("*")
      .eq("id", evaluationId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    evaluation = data as ProjectIdeaEvaluation;
  }

  const blueprintDepth = input.blueprint_depth ?? "Standard blueprint";
  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    query:
      input.query ||
      `Build campaign blueprint from final campaign truth: ${finalSelection.final_campaign_truth}`.slice(0, 280),
    max_total_chunks: Math.min(input.max_total_chunks ?? 20, 20),
    max_characters: Math.min(input.max_characters ?? 12000, 12000)
  });
  if (!contextPack) return null;

  const prompt = buildCampaignBlueprintPrompt({
    project,
    finalSelection,
    route,
    evaluation,
    dossier,
    contextPack,
    blueprintDepth,
    userInstruction: input.user_instruction
  });
  const llmResult = await generateStructuredText({
    ...prompt,
    purpose: "campaign_blueprint"
  });

  let parsed;
  try {
    parsed = parseCampaignBlueprintJson(llmResult.text);
  } catch {
    parsed = {
      blueprint_title: finalSelection.final_route_title ?? route.route_title ?? "Campaign Blueprint",
      selected_campaign_truth: finalSelection.final_campaign_truth,
      route_summary: route.route_summary ?? route.core_campaign_thought ?? route.core_thought ?? "Selected route summary requires refinement",
      strategic_problem: finalSelection.selection_rationale ?? "Strategic problem requires refinement",
      audience_tension: route.audience_tension ?? "Audience tension requires confirmation",
      category_pressure: route.category_pressure ?? "Category pressure requires confirmation",
      brand_product_truth: route.brand_product_truth ?? "Brand/product truth requires proof",
      brand_role: route.brand_role ?? "Brand role requires refinement",
      campaign_platform_statement: route.core_campaign_thought ?? finalSelection.final_campaign_truth,
      campaign_promise: "Campaign promise requires proof before client-facing use",
      message_hierarchy: {
        core_campaign_truth: finalSelection.final_campaign_truth,
        primary_message: route.core_campaign_thought ?? finalSelection.final_campaign_truth,
        secondary_support_messages: route.campaign_mechanics ?? [],
        proof_or_reason_to_believe_areas: [finalSelection.proof_required, route.proof_needed].filter(Boolean),
        possible_calls_to_action: [],
        what_not_to_say_yet: ["Do not make unsupported claims before proof is gathered"]
      },
      core_narrative_arc: "Move from audience tension to a proof-led brand role and campaign system.",
      execution_pillars: [
        {
          pillar_name: "Proof-led platform",
          what_it_does: "Preserves the locked campaign truth while proof gaps are resolved",
          audience_job: "Understand why the route matters",
          possible_formats: route.sample_touchpoints ?? [],
          proof_or_source_dependency: finalSelection.proof_required ?? route.proof_needed ?? "Proof required",
          risks_watchouts: [finalSelection.risks_watchouts, route.risks, route.risk_notes].filter(Boolean)
        }
      ],
      campaign_mechanics: route.campaign_mechanics ?? [],
      touchpoint_system: [
        {
          touchpoint: "Campaign architecture to refine",
          role: "Internal bridge from selected route to future outputs",
          formats: route.sample_touchpoints ?? [],
          proof_dependency: finalSelection.proof_required ?? route.proof_needed ?? "Proof required"
        }
      ],
      proof_stack_required: [finalSelection.proof_required, route.proof_needed, "Proof required before client-facing work"].filter(Boolean),
      assets_formats_to_explore: route.sample_touchpoints ?? [],
      rollout_logic: "Sequence proof gathering before client-facing campaign outputs.",
      risks_watchouts: [finalSelection.risks_watchouts, route.risks, route.risk_notes, "Unsupported claims must not be used as facts"].filter(Boolean),
      feasibility_notes: route.feasibility_notes ?? "Feasibility requires review before production planning",
      assumptions: [
        ...(finalSelection.assumptions ? [finalSelection.assumptions] : []),
        ...(route.assumptions ?? []),
        "Assumptions require validation"
      ],
      missing_context: [
        ...(finalSelection.missing_context ? [finalSelection.missing_context] : []),
        ...(route.missing_context ?? []),
        ...contextPack.missing_or_unavailable_context
      ],
      open_questions: route.next_refinement_questions?.length
        ? route.next_refinement_questions
        : ["What proof is required before client-facing work?"],
      next_recommended_action: finalSelection.next_action ?? "Review blueprint proof gaps and refine"
    };
  }

  const settings = llmSettings();
  const { data, error } = await supabaseAdminClient
    .from("project_campaign_blueprints")
    .insert({
      project_id: projectId,
      final_selection_id: finalSelection.id,
      developed_route_id: route.id,
      idea_card_id: ideaCardId ?? null,
      evaluation_id: evaluationId ?? null,
      dossier_id: dossierId ?? null,
      created_by: userId,
      blueprint_depth: blueprintDepth,
      ...parsed,
      missing_context: [
        ...contextPack.missing_or_unavailable_context,
        ...parsed.missing_context
      ].slice(0, 14),
      model_provider: settings.provider,
      model_name: settings.model
    })
    .select("*")
    .single();
  if (error) throw error;
  return {
    blueprint: data as CampaignBlueprint,
    contextPack,
    usage: llmResult.usage
  };
}

export async function listPitchDeckHandoffRevisionNotes(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("pitch_deck_handoff_revision_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PitchDeckHandoffRevisionNote[];
}

export async function createPitchDeckHandoffRevisionNote(
  userId: string,
  projectId: string,
  handoffId: string,
  note: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project || !supabaseAdminClient) return null;

  const { data: handoff, error: handoffError } = await supabaseAdminClient
    .from("project_pitch_deck_handoffs")
    .select("id")
    .eq("id", handoffId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (handoffError) throw handoffError;
  if (!handoff) return null;

  const { data, error } = await supabaseAdminClient
    .from("pitch_deck_handoff_revision_notes")
    .insert({ project_id: projectId, handoff_id: handoffId, created_by: userId, note })
    .select("*")
    .single();
  if (error) throw error;
  return data as PitchDeckHandoffRevisionNote;
}

export async function generatePitchDeckHandoff(
  userId: string,
  projectId: string,
  input: PitchDeckHandoffGenerateInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data: blueprintData, error: blueprintError } = await supabaseAdminClient
    .from("project_campaign_blueprints")
    .select("*")
    .eq("id", input.campaign_blueprint_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (blueprintError) throw blueprintError;
  if (!blueprintData) return null;
  const blueprint = blueprintData as CampaignBlueprint;

  let finalSelection: FinalCampaignTruth | null = null;
  const finalSelectionId = input.final_selection_id ?? blueprint.final_selection_id;
  if (finalSelectionId) {
    finalSelection = await getFinalSelectionForBlueprint(projectId, finalSelectionId);
    if (!finalSelection) return null;
  }

  let route: DevelopedRoute | null = null;
  const routeId = input.developed_route_id ?? blueprint.developed_route_id;
  if (routeId) {
    const { data, error } = await supabaseAdminClient
      .from("routes")
      .select("*")
      .eq("id", routeId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    route = data as DevelopedRoute;
  }

  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    query:
      input.query ||
      `Create pitch deck handoff from campaign blueprint: ${blueprint.blueprint_title}`.slice(0, 280),
    max_chunks_per_section: Math.min(input.max_chunks_per_section ?? 4, 4),
    max_total_chunks: Math.min(input.max_total_chunks ?? 12, 12),
    max_characters: Math.min(input.max_characters ?? 8000, 8000)
  });
  if (!contextPack) return null;

  const handoffType = input.handoff_type ?? "PPT design team handoff";
  const deckDepth = input.deck_depth ?? "Standard deck";
  const audienceType = input.audience_type ?? "Client leadership";
  const prompt = buildPitchDeckHandoffPrompt({
    project,
    blueprint,
    finalSelection,
    route,
    contextPack,
    handoffType,
    deckDepth,
    audienceType,
    userInstruction: input.user_instruction
  });
  const promptCharacters = prompt.system.length + prompt.user.length;
  const promptTokenEstimate = Math.ceil(promptCharacters / 4);
  const contextSectionCounts = Object.fromEntries(
    contextPack.sections.map((section) => [section.key, section.chunks.length])
  );
  console.info(
    JSON.stringify({
      event: "pitch_deck_handoff_generation_prepare",
      project_id: projectId,
      handoff_type: handoffType,
      deck_depth: deckDepth,
      audience_type: audienceType,
      context_total_chunks: contextPack.total_chunks,
      context_total_characters: contextPack.total_characters,
      context_mandatory_rules_found: contextPack.mandatory_rules_found,
      context_section_counts: contextSectionCounts,
      prompt_characters: promptCharacters,
      prompt_token_estimate: promptTokenEstimate
    })
  );
  const llmResult = await generateStructuredText({
    ...prompt,
    purpose: "pitch_deck_handoff",
    metadata: {
      project_id: projectId,
      handoff_type: handoffType,
      deck_depth: deckDepth,
      audience_type: audienceType,
      context_total_chunks: contextPack.total_chunks,
      context_total_characters: contextPack.total_characters,
      context_mandatory_rules_found: contextPack.mandatory_rules_found,
      prompt_characters: promptCharacters,
      prompt_token_estimate: promptTokenEstimate
    }
  });

  let parsed;
  try {
    parsed = parsePitchDeckHandoffJson(llmResult.text);
  } catch {
    parsed = parsePitchDeckHandoffJson(
      JSON.stringify({
        deck_purpose: {
          achieve: "Give a separate PPT project enough structure to build the deck",
          audience: audienceType,
          decision: "Approve the next deck build step"
        },
        core_campaign_truth: {
          final_campaign_truth: blueprint.selected_campaign_truth,
          why_selected: finalSelection?.selection_rationale ?? "Selected via final route decision",
          strategic_role: blueprint.campaign_platform_statement
        },
        narrative_arc: {
          opening_problem: blueprint.strategic_problem,
          category_tension: blueprint.category_pressure,
          audience_tension: blueprint.audience_tension,
          brand_product_truth: blueprint.brand_product_truth,
          campaign_platform: blueprint.campaign_platform_statement,
          execution_system: blueprint.execution_pillars.map((pillar) => pillar.pillar_name ?? "Execution pillar").join("; "),
          proof_and_feasibility: blueprint.proof_stack_required.join("; "),
          next_steps: blueprint.next_recommended_action
        },
        slide_structure: [
          {
            slide_number: 1,
            slide_title: "Why this campaign direction",
            slide_job: "Open with the problem and decision context",
            key_message: blueprint.strategic_problem,
            content_points: [blueprint.audience_tension, blueprint.category_pressure],
            proof_or_source_needed: blueprint.proof_stack_required,
            visual_direction: "Strategic opener, not finished visual design",
            suggested_asset_direction: "PPT project to explore visual metaphor",
            speaker_note_or_presenter_intent: "Make the route feel necessary",
            risk_watchout: "Do not overclaim proof",
            readiness_status: "Needs proof"
          },
          {
            slide_number: 2,
            slide_title: "Campaign truth and platform",
            slide_job: "Land the selected truth",
            key_message: blueprint.selected_campaign_truth,
            content_points: [blueprint.campaign_platform_statement, blueprint.campaign_promise],
            proof_or_source_needed: blueprint.proof_stack_required,
            visual_direction: "Clear hierarchy",
            suggested_asset_direction: "Typography-led route statement",
            speaker_note_or_presenter_intent: "Present strategy before execution",
            risk_watchout: "Keep internal assumptions marked",
            readiness_status: "Internal only"
          }
        ],
        section_breaks: ["Context", "Campaign Truth", "Execution System", "Proof", "Next Steps"],
        visual_design_notes: {
          mood_or_treatment_direction: "Use blueprint pillars as design territories, not final art direction",
          asset_needs: blueprint.assets_formats_to_explore,
          ppt_project_exploration: ["Explore slide hierarchy, proof visuals, and restraint"]
        },
        proof_claim_control: {
          supported_claims: [],
          claims_needing_proof: blueprint.proof_stack_required,
          claims_not_ready_for_client_deck: ["Anything not backed by proof stack"],
          data_or_assets_needed: blueprint.assets_formats_to_explore
        },
        open_questions: blueprint.open_questions,
        copy_paste_handoff: `# Pitch Deck Build Handoff\n\nProject: ${project.project_name}\nAudience: ${audienceType}\nHandoff type: ${handoffType}\nDeck depth: ${deckDepth}\n\nCampaign truth: ${blueprint.selected_campaign_truth}\n\nDeck objective: Build a separate PPT deck from this structure. Do not treat this as finished deck copy or design.\n\nNarrative arc: Problem -> campaign truth -> execution system -> proof -> next steps.\n\nProof gaps: ${blueprint.proof_stack_required.join("; ")}\n\nOpen questions: ${blueprint.open_questions.join("; ")}\n\nExpected PPT project output: a designed pitch deck based on this strategic handoff.`,
        source_grounding_summary: "Grounded in selected campaign blueprint and permission-checked context pack.",
        assumptions: blueprint.assumptions,
        missing_context: [...blueprint.missing_context, ...contextPack.missing_or_unavailable_context],
        internal_only_notes: ["This is not a generated PPT deck.", "Do not present unsupported claims."]
      })
    );
  }

  const settings = llmSettings();
  const { data, error } = await supabaseAdminClient
    .from("project_pitch_deck_handoffs")
    .insert({
      project_id: projectId,
      campaign_blueprint_id: blueprint.id,
      final_selection_id: finalSelection?.id ?? blueprint.final_selection_id ?? null,
      developed_route_id: route?.id ?? blueprint.developed_route_id ?? null,
      idea_card_id: blueprint.idea_card_id,
      evaluation_id: blueprint.evaluation_id,
      dossier_id: blueprint.dossier_id,
      created_by: userId,
      handoff_type: handoffType,
      deck_depth: deckDepth,
      audience_type: audienceType,
      ...parsed,
      missing_context: [...parsed.missing_context, ...contextPack.missing_or_unavailable_context].slice(0, 14),
      model_provider: settings.provider,
      model_name: settings.model
    })
    .select("*")
    .single();
  if (error) throw error;
  return { handoff: data as PitchDeckHandoff, contextPack, usage: llmResult.usage };
}

export async function listPitchDeckHandoffReviewNotes(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("pitch_deck_handoff_review_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PitchDeckHandoffReviewNote[];
}

export async function createPitchDeckHandoffReviewNote(
  userId: string,
  projectId: string,
  reviewId: string,
  note: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project || !supabaseAdminClient) return null;

  const { data: review, error: reviewError } = await supabaseAdminClient
    .from("pitch_deck_handoff_reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (reviewError) throw reviewError;
  if (!review) return null;

  const { data, error } = await supabaseAdminClient
    .from("pitch_deck_handoff_review_notes")
    .insert({ project_id: projectId, review_id: reviewId, created_by: userId, note })
    .select("*")
    .single();
  if (error) throw error;
  return data as PitchDeckHandoffReviewNote;
}

export async function generatePitchDeckHandoffReview(
  userId: string,
  projectId: string,
  input: PitchDeckHandoffReviewGenerateInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data: handoffData, error: handoffError } = await supabaseAdminClient
    .from("project_pitch_deck_handoffs")
    .select("*")
    .eq("id", input.pitch_deck_handoff_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (handoffError) throw handoffError;
  if (!handoffData) return null;
  const handoff = handoffData as PitchDeckHandoff;

  const { data: blueprintData, error: blueprintError } = handoff.campaign_blueprint_id
    ? await supabaseAdminClient
        .from("project_campaign_blueprints")
        .select("*")
        .eq("id", handoff.campaign_blueprint_id)
        .eq("project_id", projectId)
        .maybeSingle()
    : { data: null, error: null };
  if (blueprintError) throw blueprintError;
  const blueprint = (blueprintData as CampaignBlueprint | null) ?? null;

  const finalSelection = handoff.final_selection_id
    ? await getFinalSelectionForBlueprint(projectId, handoff.final_selection_id)
    : null;

  let route: DevelopedRoute | null = null;
  if (handoff.developed_route_id) {
    const { data, error } = await supabaseAdminClient
      .from("routes")
      .select("*")
      .eq("id", handoff.developed_route_id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    route = (data as DevelopedRoute | null) ?? null;
  }

  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    query:
      input.query ||
      `Review pitch deck handoff readiness: ${String(handoff.deck_purpose.achieve ?? handoff.handoff_type)}`.slice(0, 280),
    max_total_chunks: Math.min(input.max_total_chunks ?? 16, 16),
    max_characters: Math.min(input.max_characters ?? 12000, 12000)
  });
  if (!contextPack) return null;

  const reviewMode = input.review_mode ?? "Standard client-readiness review";
  const prompt = buildPitchDeckHandoffReviewPrompt({
    project,
    handoff,
    blueprint,
    finalSelection,
    route,
    contextPack,
    reviewMode,
    userInstruction: input.user_instruction
  });
  const llmResult = await generateStructuredText({ ...prompt, purpose: "pitch_deck_handoff_review" });
  let parsed;
  try {
    parsed = parsePitchDeckHandoffReviewJson(llmResult.text, handoff);
  } catch {
    parsed = fallbackPitchDeckHandoffReview(handoff);
  }

  const settings = llmSettings();
  const { data: reviewData, error: reviewError } = await supabaseAdminClient
    .from("pitch_deck_handoff_reviews")
    .insert({
      project_id: projectId,
      pitch_deck_handoff_id: handoff.id,
      campaign_blueprint_id: handoff.campaign_blueprint_id,
      final_selection_id: handoff.final_selection_id,
      developed_route_id: handoff.developed_route_id,
      idea_card_id: handoff.idea_card_id,
      evaluation_id: handoff.evaluation_id,
      dossier_id: handoff.dossier_id,
      created_by: userId,
      review_mode: reviewMode,
      overall_readiness_verdict: parsed.overall_readiness_verdict,
      readiness_score: parsed.readiness_score,
      client_readiness_status: parsed.client_readiness_status,
      narrative_strength_assessment: parsed.narrative_strength_assessment,
      slide_logic_assessment: parsed.slide_logic_assessment,
      proof_claim_risk_assessment: parsed.proof_claim_risk_assessment,
      unsupported_claims: parsed.unsupported_claims,
      proof_gaps: parsed.proof_gaps,
      assumptions: parsed.assumptions,
      missing_context: [...parsed.missing_context, ...contextPack.missing_or_unavailable_context].slice(0, 14),
      internal_only_risks: parsed.internal_only_risks,
      visual_asset_gaps: parsed.visual_asset_gaps,
      design_handoff_clarity_assessment: parsed.design_handoff_clarity_assessment,
      recommended_fixes: parsed.recommended_fixes,
      do_not_present_yet_warnings: parsed.do_not_present_yet_warnings,
      copy_paste_improvement_notes: parsed.copy_paste_improvement_notes,
      source_grounding_summary: parsed.source_grounding_summary,
      model_provider: settings.provider,
      model_name: settings.model
    })
    .select("*")
    .single();
  if (reviewError) throw reviewError;
  const review = reviewData as PitchDeckHandoffReview;

  const slideRows = parsed.slide_reviews.map((slide) => ({
    project_id: projectId,
    review_id: review.id,
    pitch_deck_handoff_id: handoff.id,
    slide_number: slide.slide_number,
    slide_title: slide.slide_title,
    original_readiness_status: slide.original_readiness_status,
    reviewer_readiness_status: slide.reviewer_readiness_status,
    slide_job_clarity: slide.slide_job_clarity,
    key_message_clarity: slide.key_message_clarity,
    narrative_fit: slide.narrative_fit,
    proof_status: slide.proof_status,
    claim_risk: slide.claim_risk,
    visual_asset_requirement: slide.visual_asset_requirement,
    client_input_requirement: slide.client_input_requirement,
    internal_only_concern: slide.internal_only_concern,
    genericness_risk: slide.genericness_risk,
    recommended_fix: slide.recommended_fix,
    presenter_risk_watchout: slide.presenter_risk_watchout,
    final_recommendation: slide.final_recommendation
  }));
  const { data: slideData, error: slideError } = await supabaseAdminClient
    .from("pitch_deck_handoff_slide_reviews")
    .insert(slideRows)
    .select("*");
  if (slideError) throw slideError;

  return {
    review,
    slideReviews: (slideData ?? []) as PitchDeckHandoffSlideReview[],
    contextPack,
    usage: llmResult.usage
  };
}

export async function listProjectSources(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("project_sources")
    .select("*")
    .eq("project_id", projectId)
    .eq("source_status", "active")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectSource[];
}

export async function processProjectSource(
  userId: string,
  projectId: string,
  sourceId: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  return processSourceRecord({ userId, scope: "project", sourceId, projectId });
}

export async function getSourceContentSummary(input: {
  userId: string;
  scope: "global" | "project";
  sourceId: string;
  projectId?: string;
}) {
  if (!supabaseAdminClient) return null;
  if (input.scope === "global" && !(await isAdminUser(input.userId))) return null;
  if (input.scope === "project") {
    const project = await ensureProject(input.userId, input.projectId!);
    if (!project) return null;
  }

  const { data, error } = await supabaseAdminClient
    .from("source_contents")
    .select("*")
    .eq("source_scope", input.scope)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    source_id: data.source_id,
    source_scope: data.source_scope,
    project_id: data.project_id,
    extraction_method: data.extraction_method,
    character_count: data.character_count,
    word_count: data.word_count,
    extracted_text_preview: String(data.extracted_text ?? "").slice(0, 1200),
    created_at: data.created_at,
    updated_at: data.updated_at
  } satisfies SourceContentSummary;
}

export async function listSourceChunks(input: {
  userId: string;
  scope: "global" | "project";
  sourceId: string;
  projectId?: string;
}) {
  if (!supabaseAdminClient) return null;
  if (input.scope === "global" && !(await isAdminUser(input.userId))) return null;
  if (input.scope === "project") {
    const project = await ensureProject(input.userId, input.projectId!);
    if (!project) return null;
  }

  const { data, error } = await supabaseAdminClient
    .from("source_chunks")
    .select("*")
    .eq("source_scope", input.scope)
    .eq("source_id", input.sourceId)
    .order("chunk_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SourceChunk[];
}

type SearchableSource = {
  id: string;
  project_id?: string | null;
  title: string;
  source_role: SourceSearchResult["source_role"];
  source_type: SourceSearchResult["source_type"];
  source_status: SourceSearchResult["source_status"];
};

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function createSnippet(text: string, query: string) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const index = haystack.indexOf(needle);
  const start = Math.max(0, index - 120);
  const end = Math.min(text.length, (index === -1 ? 0 : index) + query.length + 180);
  const slice = text.slice(start, end).trim();
  return {
    snippet: `${start > 0 ? "... " : ""}${slice}${end < text.length ? " ..." : ""}`,
    matchedText: index === -1 ? "" : text.slice(index, index + query.length)
  };
}

async function searchChunks(input: {
  scope: "global" | "project";
  projectId?: string;
  sources: SearchableSource[];
  filters: SourceSearchInput;
}): Promise<SourceSearchResult[]> {
  if (!supabaseAdminClient || !input.sources.length) return [];

  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const sourceIds = input.sources.map((source) => source.id);
  const limit = input.filters.limit ?? 10;

  let query = supabaseAdminClient
    .from("source_chunks")
    .select("*")
    .eq("source_scope", input.scope)
    .in("source_id", sourceIds)
    .ilike("chunk_text", `%${escapeIlike(input.filters.q)}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.scope === "project") {
    query = query.eq("project_id", input.projectId!);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as SourceChunk[])
    .map((chunk) => {
      const source = sourceById.get(chunk.source_id);
      if (!source) return null;
      const snippet = createSnippet(chunk.chunk_text, input.filters.q);
      return {
        chunk_id: chunk.id,
        source_id: chunk.source_id,
        source_scope: input.scope,
        project_id: chunk.project_id,
        source_title: source.title,
        source_role: source.source_role,
        source_type: source.source_type,
        source_status: source.source_status,
        chunk_index: chunk.chunk_index,
        snippet: snippet.snippet,
        matched_text: snippet.matchedText,
        character_count: chunk.character_count,
        token_estimate: chunk.token_estimate,
        created_at: chunk.created_at
      } satisfies SourceSearchResult;
    })
    .filter(Boolean) as SourceSearchResult[];
}

export async function searchProjectSources(
  userId: string,
  projectId: string,
  filters: SourceSearchInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  let sourceQuery = supabaseAdminClient
    .from("project_sources")
    .select("id, project_id, title, source_role, source_type, source_status")
    .eq("project_id", projectId)
    .eq("source_status", "active")
    .eq("processing_status", "processed");

  if (filters.source_role) sourceQuery = sourceQuery.eq("source_role", filters.source_role);
  if (filters.source_type) sourceQuery = sourceQuery.eq("source_type", filters.source_type);

  const { data, error } = await sourceQuery;
  if (error) throw error;

  return searchChunks({
    scope: "project",
    projectId,
    sources: (data ?? []) as SearchableSource[],
    filters
  });
}

export async function searchGlobalSources(userId: string, filters: SourceSearchInput) {
  if (!(await isAdminUser(userId))) return null;
  if (!supabaseAdminClient) return [];

  let sourceQuery = supabaseAdminClient
    .from("global_sources")
    .select("id, title, source_role, source_type, source_status")
    .eq("source_status", "active")
    .eq("processing_status", "processed");

  if (filters.source_role) sourceQuery = sourceQuery.eq("source_role", filters.source_role);
  if (filters.source_type) sourceQuery = sourceQuery.eq("source_type", filters.source_type);

  const { data, error } = await sourceQuery;
  if (error) throw error;

  return searchChunks({
    scope: "global",
    sources: (data ?? []) as SearchableSource[],
    filters
  });
}

export async function searchAllowedSources(
  userId: string,
  projectId: string,
  filters: SourceSearchInput
) {
  const projectResults = await searchProjectSources(userId, projectId, filters);
  if (!projectResults) return null;

  if (filters.scope === "project") return projectResults;
  if (filters.scope === "global") return searchGlobalSources(userId, filters);

  const globalResults = (await searchGlobalSources(userId, filters)) ?? [];
  return [...projectResults, ...globalResults].slice(0, filters.limit ?? 10);
}

export async function embedProjectSource(
  userId: string,
  projectId: string,
  sourceId: string,
  force = false
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  return embedSourceRecord({ userId, scope: "project", projectId, sourceId, force });
}

export async function embedGlobalSource(userId: string, sourceId: string, force = false) {
  if (!(await isAdminUser(userId))) return null;
  return embedSourceRecord({ userId, scope: "global", sourceId, force });
}

async function embedSourceRecord(input: {
  userId: string;
  scope: "global" | "project";
  projectId?: string;
  sourceId: string;
  force: boolean;
}) {
  if (!supabaseAdminClient) return null;
  const table = input.scope === "global" ? "global_sources" : "project_sources";
  const sourceQuery = supabaseAdminClient.from(table).select("*").eq("id", input.sourceId);
  if (input.scope === "project") sourceQuery.eq("project_id", input.projectId!);
  const { data: source, error: sourceError } = await sourceQuery.single();
  if (sourceError || !source) return null;
  if (source.processing_status !== "processed") {
    await supabaseAdminClient
      .from(table)
      .update({
        embedding_status: "skipped",
        embedding_error: "Source must be processed before embedding"
      })
      .eq("id", input.sourceId);
    return null;
  }

  await supabaseAdminClient
    .from(table)
    .update({ embedding_status: "embedding", embedding_error: null })
    .eq("id", input.sourceId);

  try {
    const settings = embeddingSettings();
    const { data: chunks, error: chunksError } = await supabaseAdminClient
      .from("source_chunks")
      .select("*")
      .eq("source_scope", input.scope)
      .eq("source_id", input.sourceId)
      .order("chunk_index", { ascending: true });
    if (chunksError) throw chunksError;

    const usableChunks = ((chunks ?? []) as SourceChunk[]).filter((chunk) =>
      chunk.chunk_text.trim()
    );
    if (!usableChunks.length) {
      const { data } = await supabaseAdminClient
        .from(table)
        .update({
          embedding_status: "skipped",
          embedding_error: "No non-empty chunks available",
          embedded_chunk_count: 0,
          failed_embedding_count: 0
        })
        .eq("id", input.sourceId)
        .select("*")
        .single();
      return data;
    }

    if (!input.force) {
      const { data: existing, error: existingError } = await supabaseAdminClient
        .from("source_chunk_embeddings")
        .select("chunk_id")
        .eq("source_scope", input.scope)
        .eq("source_id", input.sourceId)
        .eq("embedding_provider", settings.provider)
        .eq("embedding_model", settings.model)
        .eq("embedding_dimensions", settings.dimensions);
      if (existingError) throw existingError;
      const existingIds = new Set((existing ?? []).map((row) => row.chunk_id));
      if (usableChunks.every((chunk) => existingIds.has(chunk.id))) {
        const { data } = await supabaseAdminClient
          .from(table)
          .update({
            embedding_status: "embedded",
            embedding_error: null,
            embedded_chunk_count: usableChunks.length,
            failed_embedding_count: 0,
            last_embedded_at: now(),
            embedding_model: settings.model
          })
          .eq("id", input.sourceId)
          .select("*")
          .single();
        return data;
      }
    }

    if (input.force) {
      const removal = await supabaseAdminClient
        .from("source_chunk_embeddings")
        .delete()
        .eq("source_scope", input.scope)
        .eq("source_id", input.sourceId)
        .eq("embedding_provider", settings.provider)
        .eq("embedding_model", settings.model)
        .eq("embedding_dimensions", settings.dimensions);
      if (removal.error) throw removal.error;
    }

    const batchSize = Math.max(1, Math.min(settings.batchSize, 64));
    let embeddedCount = 0;
    for (let index = 0; index < usableChunks.length; index += batchSize) {
      const batch = usableChunks.slice(index, index + batchSize);
      const vectors = await embedTexts(batch.map((chunk) => chunk.chunk_text));
      const rows = batch.map((chunk, batchIndex) => ({
        chunk_id: chunk.id,
        source_id: chunk.source_id,
        project_id: chunk.project_id,
        source_scope: chunk.source_scope,
        embedding: vectorLiteral(vectors[batchIndex]),
        embedding_provider: settings.provider,
        embedding_model: settings.model,
        embedding_dimensions: settings.dimensions,
        embedding_status: "embedded",
        embedding_error: null,
        embedded_at: now()
      }));
      const { error } = await supabaseAdminClient
        .from("source_chunk_embeddings")
        .upsert(rows, {
          onConflict: "chunk_id,embedding_provider,embedding_model,embedding_dimensions"
        });
      if (error) throw error;
      embeddedCount += rows.length;
    }

    const { data, error } = await supabaseAdminClient
      .from(table)
      .update({
        embedding_status: "embedded",
        embedding_error: null,
        embedded_chunk_count: embeddedCount,
        failed_embedding_count: 0,
        last_embedded_at: now(),
        embedding_model: settings.model
      })
      .eq("id", input.sourceId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding failed";
    await supabaseAdminClient
      .from(table)
      .update({
        embedding_status: "failed",
        embedding_error: message,
        failed_embedding_count: 1
      })
      .eq("id", input.sourceId);
    throw error;
  }
}

export async function semanticSearchAllowedSources(
  userId: string,
  projectId: string | null,
  filters: SourceSearchInput
) {
  if (!supabaseAdminClient) return [];
  if (projectId) {
    const project = await ensureProject(userId, projectId);
    if (!project) return null;
  }
  if (!projectId && !(await isAdminUser(userId))) return null;
  const allowGlobal = await isAdminUser(userId);
  if ((filters.scope === "global" || filters.scope === "combined") && !allowGlobal) {
    if (filters.scope === "global") return null;
  }

  const queryVector = (await embedTexts([filters.q]))[0];
  const { data, error } = await supabaseAdminClient.rpc("match_source_chunk_embeddings", {
    query_embedding: vectorLiteral(queryVector),
    match_scope: filters.scope ?? (projectId ? "project" : "global"),
    match_project_id: projectId,
    match_source_role: filters.source_role ?? null,
    match_source_type: filters.source_type ?? null,
    allow_global: allowGlobal,
    match_limit: filters.limit ?? 10
  });
  if (error) throw error;

  return ((data ?? []) as Array<
    Omit<SourceSearchResult, "snippet" | "matched_text" | "source_scope"> & {
      source_scope: "project" | "global";
      chunk_text: string;
      similarity: number;
    }
  >).map((row) => ({
    chunk_id: row.chunk_id,
    source_id: row.source_id,
    source_scope: row.source_scope,
    project_id: row.project_id,
    source_title: row.source_title,
    source_role: row.source_role,
    source_type: row.source_type,
    source_status: row.source_status,
    chunk_index: row.chunk_index,
    snippet: String(row.chunk_text ?? "").slice(0, 320),
    matched_text: "",
    character_count: row.character_count,
    token_estimate: row.token_estimate,
    similarity: row.similarity,
    created_at: row.created_at
  }));
}

const contextSectionDefinitions: ContextPackSection[] = [
  {
    key: "mandatory_rules",
    title: "Mandatory rules",
    role: "mandatory_rule",
    chunks: []
  },
  {
    key: "project_context",
    title: "Project context",
    role: "project_context",
    chunks: []
  },
  {
    key: "strategy_intelligence",
    title: "Strategy intelligence",
    role: "strategy",
    chunks: []
  },
  {
    key: "inspiration_material",
    title: "Inspiration material",
    role: "inspiration",
    chunks: []
  },
  {
    key: "evaluation_material",
    title: "Evaluation material",
    role: "evaluation",
    chunks: []
  },
  {
    key: "general_context",
    title: "General context",
    role: "context",
    chunks: []
  }
];
const allSourceRoles: SourceRoleValue[] = [
  "context",
  "strategy",
  "inspiration",
  "evaluation",
  "mandatory_rule"
];
const allSourceTypes: SourceType[] = [
  "text",
  "markdown",
  "pdf",
  "docx",
  "image",
  "url",
  "note",
  "transcript",
  "other"
];

function searchScopeFromContextScope(scope: ContextPackScope) {
  if (scope === "project_only") return "project";
  if (scope === "global_only") return "global";
  return "combined";
}

function sectionKeyForResult(result: SourceSearchResult) {
  if (result.source_role === "mandatory_rule") return "mandatory_rules";
  if (result.source_role === "strategy") return "strategy_intelligence";
  if (result.source_role === "inspiration") return "inspiration_material";
  if (result.source_role === "evaluation") return "evaluation_material";
  if (result.source_scope === "project") return "project_context";
  return "general_context";
}

function limitSnippet(snippet: string, maxLength: number) {
  const trimmed = snippet.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 4).trim()} ...` : trimmed;
}

async function retrieveContextResults(
  userId: string,
  projectId: string | null,
  input: ContextPackInput
) {
  const searchInput = {
    q: input.query,
    scope: searchScopeFromContextScope(input.retrieval_scope ?? "project_only"),
    mode: input.retrieval_mode ?? "keyword",
    limit: input.max_total_chunks ?? 25
  } satisfies SourceSearchInput;

  const roleValues: SourceRoleValue[] = input.source_roles?.length ? input.source_roles : allSourceRoles;
  const typeValues = input.source_types?.length ? input.source_types : [];
  const results: SourceSearchResult[] = [];

  for (const sourceRole of roleValues) {
    for (const sourceType of typeValues.length ? typeValues : [undefined]) {
      const filters = {
        ...searchInput,
        source_role: sourceRole,
        source_type: sourceType
      };
      const roleResults =
        input.retrieval_mode === "semantic"
          ? await semanticSearchAllowedSources(userId, projectId, filters)
          : projectId
            ? await searchAllowedSources(userId, projectId, filters)
            : await searchGlobalSources(userId, filters);
      if (!roleResults) return null;
      results.push(...roleResults);
    }
  }

  const byChunk = new Map<string, SourceSearchResult>();
  for (const result of results) {
    if (!byChunk.has(result.chunk_id)) byChunk.set(result.chunk_id, result);
  }

  return [...byChunk.values()]
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) || b.created_at.localeCompare(a.created_at))
    .slice(0, input.max_total_chunks ?? 25);
}

export async function generateContextPack(
  userId: string,
  projectId: string | null,
  input: ContextPackInput
): Promise<ContextPack | null> {
  const retrievalScope = input.retrieval_scope ?? "project_only";
  if (retrievalScope !== "global_only") {
    if (!projectId) return null;
    const project = await ensureProject(userId, projectId);
    if (!project) return null;
  }
  if (retrievalScope === "global_only" && !(await isAdminUser(userId))) return null;

  const maxChunksPerSection = input.max_chunks_per_section ?? 5;
  const maxTotalChunks = input.max_total_chunks ?? 25;
  const maxCharacters = input.max_characters ?? 12000;
  const snippetLength = 700;
  const missing: string[] = [];
  const sourceRoles = input.source_roles?.length
    ? input.source_roles
    : allSourceRoles;
  const sourceTypes = input.source_types?.length
    ? input.source_types
    : allSourceTypes;

  if (retrievalScope === "project_plus_global" && !(await isAdminUser(userId))) {
    missing.push("Global sources were not included because this user does not have global source access.");
  }

  const results = await retrieveContextResults(userId, projectId, {
    ...input,
    source_roles: sourceRoles,
    source_types: sourceTypes,
    max_total_chunks: maxTotalChunks
  });
  if (!results) return null;
  if (!results.length) {
    missing.push("No matching processed chunks were found for the selected retrieval settings.");
  }

  const sections = contextSectionDefinitions.map((section) => ({
    ...section,
    chunks: [] as ContextPackChunk[]
  })) satisfies ContextPackSection[];
  const sectionByKey = new Map(sections.map((section) => [section.key, section]));
  let totalChunks = 0;
  let totalCharacters = 0;

  for (const result of results) {
    if (totalChunks >= maxTotalChunks || totalCharacters >= maxCharacters) break;
    const section = sectionByKey.get(sectionKeyForResult(result));
    if (!section || section.chunks.length >= maxChunksPerSection) continue;

    const remainingCharacters = maxCharacters - totalCharacters;
    if (remainingCharacters <= 0) break;
    const snippet = limitSnippet(result.snippet, Math.min(snippetLength, remainingCharacters));
    if (!snippet) continue;

    section.chunks.push({
      chunk_id: result.chunk_id,
      source_id: result.source_id,
      source_scope: result.source_scope,
      project_id: result.project_id,
      source_title: result.source_title,
      source_role: result.source_role,
      source_type: result.source_type,
      chunk_index: result.chunk_index,
      snippet,
      matched_text: result.matched_text,
      similarity: result.similarity
    });
    totalChunks += 1;
    totalCharacters += snippet.length;
  }

  if (!sections.some((section) => section.chunks.length)) {
    missing.push("No chunks remained after context pack limits and filters were applied.");
  }
  if (!sections.find((section) => section.key === "mandatory_rules")?.chunks.length) {
    missing.push("No mandatory rule source chunks were found.");
  }

  return {
    project_id: projectId,
    user_id: userId,
    query: input.query,
    retrieval_scope: retrievalScope,
    retrieval_mode: input.retrieval_mode ?? "keyword",
    created_at: now(),
    sections,
    assumptions: {
      retrieval_scope: retrievalScope,
      retrieval_mode: input.retrieval_mode ?? "keyword",
      included_source_roles: sourceRoles,
      included_source_types: sourceTypes,
      max_chunks_per_section: maxChunksPerSection,
      max_total_chunks: maxTotalChunks,
      max_characters: maxCharacters,
      snippet_length: snippetLength
    },
    missing_or_unavailable_context: missing,
    total_chunks: totalChunks,
    total_characters: totalCharacters,
    mandatory_rules_found: Boolean(
      sections.find((section) => section.key === "mandatory_rules")?.chunks.length
    )
  };
}

function buildGroundingSummary(contextPack: ContextPack) {
  const chunks = contextPack.sections.flatMap((section) => section.chunks);
  return {
    context_pack_total_chunks: contextPack.total_chunks,
    mandatory_rule_chunks:
      contextPack.sections.find((section) => section.key === "mandatory_rules")?.chunks.length ?? 0,
    source_titles: [...new Set(chunks.map((chunk) => chunk.source_title))].slice(0, 30),
    source_roles: [...new Set(chunks.map((chunk) => chunk.source_role))],
    source_scopes: [...new Set(chunks.map((chunk) => chunk.source_scope))]
  };
}

export async function listProjectDossiers(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("project_dossiers")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectDossier[];
}

export async function generateProjectDossier(
  userId: string,
  projectId: string,
  input: DossierGenerateInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    max_total_chunks: Math.min(input.max_total_chunks ?? 18, 18),
    max_characters: Math.min(input.max_characters ?? 10000, 10000)
  });
  if (!contextPack) return null;

  const prompt = buildDossierPrompt({ project, contextPack });
  const llmResult = await generateStructuredText({
    ...prompt,
    purpose: "creative_intelligence_dossier"
  });

  let parsed;
  try {
    parsed = parseDossierJson(llmResult.text);
  } catch {
    throw new Error("Model output could not be parsed into a dossier");
  }

  const settings = llmSettings();
  const grounding = buildGroundingSummary(contextPack);
  const missingContext = [
    ...contextPack.missing_or_unavailable_context,
    ...parsed.missing_context
  ].slice(0, 12);

  const { data, error } = await supabaseAdminClient
    .from("project_dossiers")
    .insert({
      project_id: projectId,
      created_by: userId,
      title: input.title?.trim() || "Creative Intelligence Dossier",
      task_query: input.query,
      retrieval_scope: input.retrieval_scope ?? "project_only",
      retrieval_mode: input.retrieval_mode ?? "keyword",
      selected_roles: contextPack.assumptions.included_source_roles,
      selected_source_types: contextPack.assumptions.included_source_types,
      dossier_content: { sections: parsed.sections },
      grounding_metadata: grounding,
      assumptions: parsed.assumptions,
      missing_context: missingContext,
      model_provider: settings.provider,
      model_name: settings.model
    })
    .select("*")
    .single();

  if (error) throw error;
  return {
    dossier: data as ProjectDossier,
    contextPack,
    usage: llmResult.usage
  };
}

export async function listProjectIdeaCards(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("project_idea_cards")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectIdeaCard[];
}

async function getProjectDossierForIdeation(
  userId: string,
  projectId: string,
  dossierId?: string
) {
  if (!dossierId || !supabaseAdminClient) return null;
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  const { data, error } = await supabaseAdminClient
    .from("project_dossiers")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", dossierId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectDossier | null) ?? null;
}

export async function generateProjectIdeaCards(
  userId: string,
  projectId: string,
  input: IdeationGenerateInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const ideaCount = Math.min(Math.max(input.idea_count ?? 8, 3), 15);
  const braveryLevel = input.bravery_level ?? "Sharp";
  const dossier = await getProjectDossierForIdeation(userId, projectId, input.dossier_id);
  if (input.dossier_id && !dossier) return null;

  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    max_total_chunks: Math.min(input.max_total_chunks ?? 18, 18),
    max_characters: Math.min(input.max_characters ?? 10000, 10000)
  });
  if (!contextPack) return null;

  const prompt = buildIdeationPrompt({
    project,
    contextPack,
    dossier,
    ideation: {
      query: input.query,
      bravery_level: braveryLevel,
      idea_count: ideaCount,
      user_instruction: input.user_instruction
    }
  });
  const llmResult = await generateStructuredText({
    ...prompt,
    purpose: "first_pass_ideation"
  });

  let ideas;
  try {
    ideas = parseIdeationJson(llmResult.text, ideaCount);
  } catch {
    throw new Error("Model output could not be parsed into idea cards");
  }

  const settings = llmSettings();
  const runInsert = await supabaseAdminClient
    .from("project_ideation_runs")
    .insert({
      project_id: projectId,
      created_by: userId,
      dossier_id: dossier?.id ?? null,
      task_query: input.query,
      bravery_level: braveryLevel,
      retrieval_scope: input.retrieval_scope ?? "project_only",
      retrieval_mode: input.retrieval_mode ?? "keyword",
      selected_roles: contextPack.assumptions.included_source_roles,
      selected_source_types: contextPack.assumptions.included_source_types,
      model_provider: settings.provider,
      model_name: settings.model,
      idea_count: ideas.length
    })
    .select("*")
    .single();
  if (runInsert.error) throw runInsert.error;

  const rows = ideas.map((idea) => ({
    project_id: projectId,
    created_by: userId,
    dossier_id: dossier?.id ?? null,
    generation_run_id: runInsert.data.id,
    ...idea,
    bravery_level: braveryLevel,
    retrieval_scope: input.retrieval_scope ?? "project_only",
    retrieval_mode: input.retrieval_mode ?? "keyword",
    selected_roles: contextPack.assumptions.included_source_roles,
    selected_source_types: contextPack.assumptions.included_source_types,
    status: "generated"
  }));
  const cardInsert = await supabaseAdminClient
    .from("project_idea_cards")
    .insert(rows)
    .select("*")
    .order("created_at", { ascending: false });
  if (cardInsert.error) throw cardInsert.error;

  return {
    run: runInsert.data as ProjectIdeationRun,
    ideas: (cardInsert.data ?? []) as ProjectIdeaCard[],
    contextPack,
    usage: llmResult.usage
  };
}

export async function updateProjectIdeaCardStatus(
  userId: string,
  projectId: string,
  ideaId: string,
  input: { status: "rejected" | "shortlisted"; reason?: string }
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const patch =
    input.status === "rejected"
      ? {
          status: "rejected",
          rejection_reason: emptyToNull(input.reason),
          shortlist_reason: null
        }
      : {
          status: "shortlisted",
          shortlist_reason: emptyToNull(input.reason),
          rejection_reason: null
        };

  const { data, error } = await supabaseAdminClient
    .from("project_idea_cards")
    .update(patch)
    .eq("project_id", projectId)
    .eq("id", ideaId)
    .select("*")
    .single();
  if (error) return null;
  return data as ProjectIdeaCard;
}

export async function listProjectIdeaEvaluations(userId: string, projectId: string) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return [];

  const { data, error } = await supabaseAdminClient
    .from("project_idea_evaluations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectIdeaEvaluation[];
}

async function listIdeaCardsForEvaluation(
  userId: string,
  projectId: string,
  ideaCardIds: string[]
) {
  const project = await ensureProject(userId, projectId);
  if (!project || !supabaseAdminClient) return null;

  const uniqueIds = [...new Set(ideaCardIds)];
  const { data, error } = await supabaseAdminClient
    .from("project_idea_cards")
    .select("*")
    .eq("project_id", projectId)
    .in("id", uniqueIds);
  if (error) throw error;
  const ideas = (data ?? []) as ProjectIdeaCard[];
  if (ideas.length !== uniqueIds.length) return null;
  return ideas.sort((a, b) => uniqueIds.indexOf(a.id) - uniqueIds.indexOf(b.id));
}

export async function generateProjectIdeaEvaluations(
  userId: string,
  projectId: string,
  input: IdeaEvaluationGenerateInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const ideas = await listIdeaCardsForEvaluation(userId, projectId, input.idea_card_ids);
  if (!ideas) return null;

  const dossier = await getProjectDossierForIdeation(userId, projectId, input.dossier_id);
  if (input.dossier_id && !dossier) return null;

  const contextPack = await generateContextPack(userId, projectId, {
    ...input,
    query:
      input.query ||
      `Evaluate idea cards: ${ideas.map((idea) => idea.title).join(", ")}`.slice(0, 280),
    max_total_chunks: Math.min(input.max_total_chunks ?? 18, 18),
    max_characters: Math.min(input.max_characters ?? 10000, 10000)
  });
  if (!contextPack) return null;

  const evaluationMode = input.evaluation_mode ?? "Strategic review";
  const prompt = buildIdeaEvaluationPrompt({
    project,
    ideas,
    contextPack,
    dossier,
    evaluationMode
  });
  const llmResult = await generateStructuredText({
    ...prompt,
    purpose: "idea_evaluation_red_team_scoring"
  });

  let parsed;
  try {
    parsed = parseIdeaEvaluationJson(
      llmResult.text,
      ideas.map((idea) => idea.id)
    );
  } catch {
    throw new Error("Model output could not be parsed into idea evaluations");
  }

  const settings = llmSettings();
  const rows = parsed.map((evaluation) => ({
    project_id: projectId,
    idea_card_id: evaluation.idea_card_id,
    created_by: userId,
    evaluation_mode: evaluationMode,
    dossier_id: dossier?.id ?? null,
    retrieval_scope: input.retrieval_scope ?? "project_only",
    retrieval_mode: input.retrieval_mode ?? "keyword",
    selected_roles: contextPack.assumptions.included_source_roles,
    selected_source_types: contextPack.assumptions.included_source_types,
    scores_json: evaluation.scores_json,
    overall_sharpness_score: evaluation.overall_sharpness_score,
    genericness_risk_score: evaluation.genericness_risk_score,
    development_readiness: evaluation.development_readiness,
    overall_verdict: evaluation.overall_verdict,
    strongest_aspect: evaluation.strongest_aspect,
    weakest_aspect: evaluation.weakest_aspect,
    source_grounding_assessment: evaluation.source_grounding_assessment,
    unsupported_claims: evaluation.unsupported_claims,
    feasibility_risks: evaluation.feasibility_risks,
    sharpness_suggestions: evaluation.sharpness_suggestions,
    recommended_action: evaluation.recommended_action,
    model_provider: settings.provider,
    model_name: settings.model
  }));

  const insert = await supabaseAdminClient
    .from("project_idea_evaluations")
    .insert(rows)
    .select("*")
    .order("created_at", { ascending: false });
  if (insert.error) throw insert.error;

  return {
    evaluations: (insert.data ?? []) as ProjectIdeaEvaluation[],
    contextPack,
    usage: llmResult.usage
  };
}

export async function createProjectSource(
  userId: string,
  projectId: string,
  input: SourceInput
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("project_sources")
    .insert({ project_id: projectId, ...normalizeSource(input) })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, {});
  await runAutomaticSourcePipeline({
    userId,
    scope: "project",
    projectId,
    sourceId: data.id
  });
  return (await getProjectSourceById(projectId, data.id)) ?? (data as ProjectSource);
}

async function getProjectSourceById(projectId: string, sourceId: string) {
  if (!supabaseAdminClient) return null;
  const { data, error } = await supabaseAdminClient
    .from("project_sources")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectSource | null) ?? null;
}

export async function createProjectFileSource(
  userId: string,
  projectId: string,
  input: SourceInput,
  file: Express.Multer.File
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const sourceId = id();
  const safeFileName = sanitizeFileName(file.originalname);
  const storagePath = `${userId}/${projectId}/${sourceId}/${safeFileName}`;

  const upload = await supabaseAdminClient.storage
    .from("project-sources")
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (upload.error) throw upload.error;

  const { data, error } = await supabaseAdminClient
    .from("project_sources")
    .insert({
      id: sourceId,
      project_id: projectId,
      ...normalizeSource(input),
      file_name: safeFileName,
      file_type: file.mimetype,
      file_size: file.size,
      mime_type: file.mimetype,
      storage_bucket: "project-sources",
      storage_path: storagePath,
      uploaded_at: now(),
      uploaded_by: userId
    })
    .select("*")
    .single();

  if (error) throw error;
  await updateProject(userId, projectId, {});
  await runAutomaticSourcePipeline({
    userId,
    scope: "project",
    projectId,
    sourceId
  });
  return (await getProjectSourceById(projectId, sourceId)) ?? (data as ProjectSource);
}

export async function createProjectSourceSignedUrl(
  userId: string,
  projectId: string,
  sourceId: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data: source, error } = await supabaseAdminClient
    .from("project_sources")
    .select("storage_bucket, storage_path")
    .eq("project_id", projectId)
    .eq("id", sourceId)
    .single();

  if (error || !source?.storage_bucket || !source.storage_path) return null;

  const signed = await supabaseAdminClient.storage
    .from(source.storage_bucket)
    .createSignedUrl(source.storage_path, 60);

  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
}

export async function createGlobalSourceSignedUrl(userId: string, sourceId: string) {
  if (!(await isAdminUser(userId))) return null;
  if (!supabaseAdminClient) return null;

  const { data: source, error } = await supabaseAdminClient
    .from("global_sources")
    .select("storage_bucket, storage_path")
    .eq("id", sourceId)
    .single();

  if (error || !source?.storage_bucket || !source.storage_path) return null;

  const signed = await supabaseAdminClient.storage
    .from(source.storage_bucket)
    .createSignedUrl(source.storage_path, 60);

  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
}

export async function updateProjectSource(
  userId: string,
  projectId: string,
  sourceId: string,
  patch: Partial<SourceInput>
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("project_sources")
    .update(normalizeSource(patch))
    .eq("project_id", projectId)
    .eq("id", sourceId)
    .select("*")
    .single();

  if (error) return null;
  await updateProject(userId, projectId, {});
  return data as ProjectSource;
}

export async function archiveProjectSource(
  userId: string,
  projectId: string,
  sourceId: string
) {
  const project = await ensureProject(userId, projectId);
  if (!project) return null;
  if (!supabaseAdminClient) return null;

  const { data, error } = await supabaseAdminClient
    .from("project_sources")
    .update({ source_status: "archived" })
    .eq("project_id", projectId)
    .eq("id", sourceId)
    .select("*")
    .single();

  if (error) return null;
  await updateProject(userId, projectId, {});
  return data as ProjectSource;
}
