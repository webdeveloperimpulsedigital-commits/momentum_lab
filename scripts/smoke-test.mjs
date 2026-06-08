import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readLocalEnv() {
  if (!existsSync(".env")) return {};

  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

const port = process.env.SMOKE_TEST_PORT ?? "3210";
const baseUrl = `http://127.0.0.1:${port}`;
const localEnv = readLocalEnv();
const adminEmail = process.env.ADMIN_EMAIL || localEnv.ADMIN_EMAIL || "admin@momentum.local";
const adminPassword = process.env.ADMIN_PASSWORD || localEnv.ADMIN_PASSWORD || "password";
let cookie = "";
let supabaseAdminForCleanup = null;
let userBIdForCleanup = null;

const server = spawn("node", ["server/dist/index.js"], {
  cwd: process.cwd(),
  env: {
    ...localEnv,
    ...process.env,
    PORT: port,
    APP_BASE_URL: process.env.APP_BASE_URL || localEnv.APP_BASE_URL || "http://localhost:5173"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

server.stdout.on("data", (chunk) => {
  if (process.env.SMOKE_VERBOSE) process.stdout.write(chunk);
});

server.stderr.on("data", (chunk) => {
  if (process.env.SMOKE_VERBOSE) process.stderr.write(chunk);
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {})
  };

  if (cookie) headers.cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function requestWithCookie(path, sessionCookie, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
    cookie: sessionCookie
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });

  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  return { response, body };
}

async function expectBlockedWithCookie(path, sessionCookie, options = {}) {
  const { response, body } = await requestWithCookie(path, sessionCookie, options);
  if (![403, 404].includes(response.status)) {
    throw new Error(`${path} should be blocked but returned ${response.status}: ${JSON.stringify(body)}`);
  }
  const serialized = JSON.stringify(body);
  if (
    serialized.includes("sourcepack") ||
    serialized.includes("thought starter") ||
    serialized.includes("Sourcepack") ||
    serialized.includes("Smoke")
  ) {
    throw new Error(`${path} leaked inaccessible ideation or source data`);
  }
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await request("/health");
    } catch (error) {
      lastError = error;
      await wait(500);
    }
  }
  throw lastError;
}

async function upload(path, fields, file) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, Array.isArray(value) ? value.join(",") : value ?? "");
  }
  formData.set("file", new Blob([file.content], { type: file.type }), file.name);

  const headers = {};
  if (cookie) headers.cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: formData
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function expectUploadFailure(path, fields, file) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, Array.isArray(value) ? value.join(",") : value ?? "");
  }
  formData.set("file", new Blob([file.content], { type: file.type }), file.name);

  const headers = {};
  if (cookie) headers.cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: formData
  });

  if (response.ok) {
    throw new Error(`${path} unexpectedly accepted invalid upload`);
  }
}

async function run() {
  const health = await waitForHealth();
  await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  const adminCookie = cookie;
  let userBCookie = "";

  if (!localEnv.SUPABASE_URL || !localEnv.SUPABASE_ANON_KEY || !localEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase credentials are required for ideation RLS smoke coverage");
  }

  const supabaseAdmin = createClient(localEnv.SUPABASE_URL, localEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  supabaseAdminForCleanup = supabaseAdmin;
  const userBEmail = `build10-rls-${Date.now()}@momentum.local`;
  const userBPassword = `Build10-${crypto.randomUUID()}!`;
  const createdUserB = await supabaseAdmin.auth.admin.createUser({
    email: userBEmail,
    password: userBPassword,
    email_confirm: true
  });
  if (createdUserB.error || !createdUserB.data.user) {
    throw createdUserB.error ?? new Error("Could not create temporary User B");
  }
  userBIdForCleanup = createdUserB.data.user.id;
  const userBLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: userBEmail, password: userBPassword })
  });
  if (!userBLogin.user?.id) {
    throw new Error("Expected temporary User B to log in through app auth");
  }
  userBCookie = cookie;
  cookie = adminCookie;

  const globalCreated = await request("/api/global-sources", {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke global source",
      description: "Global metadata source for smoke testing",
      source_role: "context",
      source_type: "url",
      source_url: "https://example.com",
      tags: ["smoke", "global"],
      source_status: "active"
    })
  });

  const globalUpload = await upload(
    "/api/global-sources/upload",
    {
      title: "Smoke global file source",
      description: "Global file source for smoke testing",
      source_role: "mandatory_rule",
      source_type: "text",
      source_status: "active",
      tags: ["smoke", "file"]
    },
    {
      name: "global-smoke.txt",
      type: "text/plain",
      content: "Global source file"
    }
  );

  await request(`/api/global-sources/${globalCreated.source.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      description: "Updated global metadata source for smoke testing",
      tags: ["smoke", "global", "updated"]
    })
  });
  await request(`/api/global-sources/${globalUpload.source.id}/download`);
  const processedGlobal = await request(`/api/global-sources/${globalUpload.source.id}/process`, {
    method: "POST"
  });
  if (processedGlobal.source.processing_status !== "processed") {
    throw new Error("Expected global TXT source to process successfully");
  }
  await request(`/api/global-sources/${globalUpload.source.id}/content`);
  const globalSearch = await request(
    "/api/global-sources/search?q=Global%20source%20file&source_role=mandatory_rule&source_type=text&limit=5"
  );
  if (!globalSearch.results.some((result) => result.source_id === globalUpload.source.id)) {
    throw new Error("Expected global source search to find processed global file");
  }
  const embeddedGlobal = await request(`/api/global-sources/${globalUpload.source.id}/embed`, {
    method: "POST",
    body: JSON.stringify({ force: true })
  });
  if (embeddedGlobal.source.embedding_status !== "embedded") {
    throw new Error("Expected global source embeddings to be generated");
  }
  const semanticGlobalSearch = await request(
    "/api/global-sources/search?q=reusable%20global%20file&mode=semantic&source_role=mandatory_rule&source_type=text&limit=20"
  );
  if (!semanticGlobalSearch.results.some((result) => result.source_id === globalUpload.source.id)) {
    throw new Error("Expected semantic global source search to find embedded global file");
  }
  const globalContextPack = await request("/api/global-sources/context-pack", {
    method: "POST",
    body: JSON.stringify({
      query: "Global source file",
      retrieval_scope: "global_only",
      retrieval_mode: "keyword",
      source_roles: ["mandatory_rule"],
      source_types: ["text"]
    })
  });
  if (!globalContextPack.contextPack.mandatory_rules_found) {
    throw new Error("Expected global context pack to include mandatory rules");
  }

  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      project_name: "Momentum Lab Smoke Test",
      client_name: "Internal",
      category: "Scaffold",
      bravery_level: "Sharp",
      research_depth: "Standard",
      status: "Draft",
      desired_output_type: "Workspace verification"
    })
  });

  const projectId = created.project.id;
  await request(`/api/projects/${projectId}`);

  const updated = await request(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ current_stage: "Research", market: "India" })
  });

  if (updated.project.current_stage !== "Research") {
    throw new Error("Project update did not persist in active storage layer");
  }

  await request(`/api/projects/${projectId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: "Check persistence readiness." })
  });

  const messages = await request(`/api/projects/${projectId}/messages`);
  if (messages.messages.length < 2) {
    throw new Error("Expected user and assistant messages after message creation");
  }

  await request(`/api/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content: "Smoke test note" })
  });

  await request(`/api/projects/${projectId}/rejected-ideas`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke rejected idea",
      idea_text: "A deliberately rejected idea",
      reason_for_rejection: "Not distinct enough"
    })
  });

  await request(`/api/projects/${projectId}/shortlisted-ideas`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke shortlisted idea",
      idea_text: "A candidate thought starter",
      why_shortlisted: "Useful territory"
    })
  });

  const route = await request(`/api/projects/${projectId}/routes`, {
    method: "POST",
    body: JSON.stringify({
      route_title: "Smoke route",
      core_thought: "A focused strategic route",
      audience_tension: "Need clarity without losing ambition",
      brand_role: "Make the next step feel possible",
      execution_notes: "Simple route notes",
      risks: "May be too safe"
    })
  });

  await request(`/api/projects/${projectId}/final-truth`, {
    method: "PUT",
    body: JSON.stringify({
      developed_route_id: route.route.id,
      final_route_title: "Smoke final route",
      final_campaign_truth: "Momentum comes from visible progress.",
      selection_rationale: "Matches the workspace foundation",
      why_this_route_won: "It is the clearest early route",
      rejected_or_deprioritised_notes: "Broader routes were less focused",
      proof_required: "Confirm the audience tension with project evidence",
      risks_watchouts: "May be too safe",
      assumptions: "Visible progress is motivating",
      missing_context: "Client appetite for restraint",
      next_action: "Proceed to next build"
    })
  });

  const pastedProjectSource = await request(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke pasted project source",
      description: "Project pasted text source",
      source_role: "strategy",
      source_type: "text",
      content_text: "A sourcepack pasted source for Momentum Lab strategy context.",
      tags: ["project", "paste"],
      source_status: "active"
    })
  });

  const inspirationProjectSource = await request(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke inspiration source",
      source_role: "inspiration",
      source_type: "text",
      content_text: "Sourcepack inspiration material should remain separate from mandatory rules.",
      tags: ["project", "inspiration"],
      source_status: "active"
    })
  });

  const evaluationProjectSource = await request(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke evaluation source",
      source_role: "evaluation",
      source_type: "text",
      content_text: "Sourcepack evaluation material should be grouped for future critique.",
      tags: ["project", "evaluation"],
      source_status: "active"
    })
  });

  const projectUpload = await upload(
    `/api/projects/${projectId}/sources/upload`,
    {
      title: "Smoke project file source",
      description: "Project file source",
      source_role: "context",
      source_type: "text",
      source_status: "active",
      tags: ["project", "file"]
    },
    {
      name: "project-smoke.md",
      type: "text/markdown",
      content: "# Sourcepack project source file"
    }
  );

  await request(`/api/projects/${projectId}/sources/${projectUpload.source.id}/download`);
  await request(`/api/projects/${projectId}/sources/${pastedProjectSource.source.id}/process`, {
    method: "POST"
  });
  await request(`/api/projects/${projectId}/sources/${inspirationProjectSource.source.id}/process`, {
    method: "POST"
  });
  await request(`/api/projects/${projectId}/sources/${evaluationProjectSource.source.id}/process`, {
    method: "POST"
  });
  const processedProjectFile = await request(
    `/api/projects/${projectId}/sources/${projectUpload.source.id}/process`,
    { method: "POST" }
  );
  if (processedProjectFile.source.processing_status !== "processed") {
    throw new Error("Expected project Markdown source to process successfully");
  }
  const projectContent = await request(
    `/api/projects/${projectId}/sources/${projectUpload.source.id}/content`
  );
  const projectChunks = await request(
    `/api/projects/${projectId}/sources/${projectUpload.source.id}/chunks`
  );
  if (!projectContent.content.extracted_text_preview || projectChunks.chunks.length < 1) {
    throw new Error("Expected extracted project content and chunks");
  }
  const projectSearch = await request(
    `/api/projects/${projectId}/source-search?q=Project%20source%20file&scope=project&source_role=context&source_type=text&limit=5`
  );
  if (!projectSearch.results.some((result) => result.source_id === projectUpload.source.id)) {
    throw new Error("Expected project source search to find processed project file");
  }
  const embeddedProject = await request(
    `/api/projects/${projectId}/sources/${projectUpload.source.id}/embed`,
    {
      method: "POST",
      body: JSON.stringify({ force: true })
    }
  );
  if (embeddedProject.source.embedding_status !== "embedded") {
    throw new Error("Expected project source embeddings to be generated");
  }
  const semanticProjectSearch = await request(
    `/api/projects/${projectId}/source-search?q=project%20markdown%20source&scope=project&mode=semantic&source_role=context&source_type=text&limit=5`
  );
  if (!semanticProjectSearch.results.some((result) => result.source_id === projectUpload.source.id)) {
    throw new Error("Expected semantic project search to find embedded project file");
  }
  const projectContextPack = await request(`/api/projects/${projectId}/context-pack`, {
    method: "POST",
    body: JSON.stringify({
      query: "sourcepack",
      retrieval_scope: "project_only",
      retrieval_mode: "keyword",
      source_roles: ["context", "strategy", "inspiration", "evaluation"],
      source_types: ["text"],
      max_total_chunks: 10
    })
  });
  const sectionCounts = Object.fromEntries(
    projectContextPack.contextPack.sections.map((section) => [section.key, section.chunks.length])
  );
  if (
    !sectionCounts.project_context ||
    !sectionCounts.strategy_intelligence ||
    !sectionCounts.inspiration_material ||
    !sectionCounts.evaluation_material
  ) {
    throw new Error("Expected project context pack role sections to be populated");
  }
  if (sectionCounts.mandatory_rules) {
    throw new Error("Inspiration/context/strategy/evaluation sources must not become mandatory rules");
  }
  const combinedSearch = await request(
    `/api/projects/${projectId}/source-search?q=source&scope=combined&limit=10`
  );
  const combinedScopes = new Set(combinedSearch.results.map((result) => result.source_scope));
  if (!combinedScopes.has("project") || !combinedScopes.has("global")) {
    throw new Error("Expected combined search to include allowed project and global chunks");
  }
  const semanticCombinedSearch = await request(
    `/api/projects/${projectId}/source-search?q=source%20file&scope=combined&mode=semantic&limit=20`
  );
  const semanticCombinedScopes = new Set(
    semanticCombinedSearch.results.map((result) => result.source_scope)
  );
  if (!semanticCombinedScopes.has("project") || !semanticCombinedScopes.has("global")) {
    throw new Error("Expected semantic combined search to include allowed project and global chunks");
  }
  const combinedContextPack = await request(`/api/projects/${projectId}/context-pack`, {
    method: "POST",
    body: JSON.stringify({
      query: "source file",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "mandatory_rule"],
      source_types: ["text"],
      max_total_chunks: 25
    })
  });
  const combinedScopesInPack = new Set(
    combinedContextPack.contextPack.sections.flatMap((section) =>
      section.chunks.map((chunk) => chunk.source_scope)
    )
  );
  if (!combinedScopesInPack.has("project") || !combinedScopesInPack.has("global")) {
    throw new Error("Expected combined context pack to include allowed project and global chunks");
  }
  const generatedDossier = await request(`/api/projects/${projectId}/dossiers`, {
    method: "POST",
    body: JSON.stringify({
      query: "Prepare a concise grounded dossier for sourcepack strategy.",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"],
      max_total_chunks: 8
    })
  });
  if (!generatedDossier.dossier?.id) {
    throw new Error("Expected dossier generation to store a dossier");
  }
  const dossierSections = generatedDossier.dossier.dossier_content.sections ?? [];
  if (dossierSections.length !== 12) {
    throw new Error("Expected dossier to contain the required 12 sections");
  }
  if (!generatedDossier.dossier.assumptions.length) {
    throw new Error("Expected dossier to label assumptions");
  }
  if (!generatedDossier.dossier.missing_context.length) {
    throw new Error("Expected dossier to list missing context");
  }
  if (!generatedDossier.dossier.grounding_metadata.context_pack_total_chunks) {
    throw new Error("Expected dossier to include grounding metadata from the context pack");
  }
  const storedDossiers = await request(`/api/projects/${projectId}/dossiers`);
  if (!storedDossiers.dossiers.some((dossier) => dossier.id === generatedDossier.dossier.id)) {
    throw new Error("Expected stored dossier to be listed");
  }
  const generatedIdeas = await request(`/api/projects/${projectId}/idea-cards/generate`, {
    method: "POST",
    body: JSON.stringify({
      query: "Generate sourcepack thought starters that obey mandatory rules and use inspiration only as stimulus.",
      dossier_id: generatedDossier.dossier.id,
      bravery_level: "Sharp",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"],
      idea_count: 3
    })
  });
  const braveryChecks = {
    Sharp: generatedIdeas.ideas.length
  };
  if (generatedIdeas.ideas.length < 3 || generatedIdeas.ideas.length > 15) {
    throw new Error("Expected generated idea count within requested limits");
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
  ];
  for (const idea of generatedIdeas.ideas) {
    for (const field of requiredIdeaFields) {
      if (!idea[field]) throw new Error(`Expected generated idea field ${field}`);
    }
  }
  const storedIdeas = await request(`/api/projects/${projectId}/idea-cards`);
  if (!storedIdeas.ideas.some((idea) => idea.id === generatedIdeas.ideas[0].id)) {
    throw new Error("Expected generated idea cards to be stored");
  }
  for (const braveryLevel of ["Safe", "Bold", "Wild", "Chaos first"]) {
    const braveryIdeas = await request(`/api/projects/${projectId}/idea-cards/generate`, {
      method: "POST",
      body: JSON.stringify({
        query: `Generate ${braveryLevel} sourcepack thought starters that obey mandatory rules and avoid genericness.`,
        dossier_id: generatedDossier.dossier.id,
        bravery_level: braveryLevel,
        retrieval_scope: "project_plus_global",
        retrieval_mode: "semantic",
        source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
        source_types: ["text"],
        idea_count: 3
      })
    });
    if (braveryIdeas.ideas.length < 3 || braveryIdeas.ideas.length > 15) {
      throw new Error(`Expected ${braveryLevel} idea count within requested limits`);
    }
    if (!braveryIdeas.ideas.every((idea) => idea.bravery_level === braveryLevel)) {
      throw new Error(`Expected generated cards to store ${braveryLevel} bravery level`);
    }
    braveryChecks[braveryLevel] = braveryIdeas.ideas.length;
  }
  const tooManyIdeasResponse = await fetch(
    `${baseUrl}/api/projects/${projectId}/idea-cards/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie
      },
      body: JSON.stringify({
        query: "Try to exceed the idea count limit",
        bravery_level: "Sharp",
        retrieval_scope: "project_only",
        retrieval_mode: "keyword",
        source_roles: ["context"],
        source_types: ["text"],
        idea_count: 16
      })
    }
  );
  if (tooManyIdeasResponse.status !== 400) {
    throw new Error("Expected idea generation above the hard cap to be rejected");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/idea-cards`, userBCookie);
  await expectBlockedWithCookie(`/api/projects/${projectId}/idea-cards/generate`, userBCookie, {
    method: "POST",
    body: JSON.stringify({
      query: "Try to generate against another user's project and source snippets",
      bravery_level: "Sharp",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"],
      idea_count: 3
    })
  });
  await expectBlockedWithCookie(
    `/api/projects/${projectId}/idea-cards/${generatedIdeas.ideas[0].id}/reject`,
    userBCookie,
    {
      method: "POST",
      body: JSON.stringify({ reason: "Should be blocked" })
    }
  );
  await expectBlockedWithCookie(
    `/api/projects/${projectId}/idea-cards/${generatedIdeas.ideas[1].id}/shortlist`,
    userBCookie,
    {
      method: "POST",
      body: JSON.stringify({ reason: "Should be blocked" })
    }
  );

  const userASupabase = createClient(localEnv.SUPABASE_URL, localEnv.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  const userBSupabase = createClient(localEnv.SUPABASE_URL, localEnv.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  const userASession = await userASupabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });
  if (userASession.error) throw userASession.error;
  const userBSession = await userBSupabase.auth.signInWithPassword({
    email: userBEmail,
    password: userBPassword
  });
  if (userBSession.error) throw userBSession.error;

  const userAIdeaCards = await userASupabase
    .from("project_idea_cards")
    .select("id,title,project_id")
    .eq("project_id", projectId);
  if (userAIdeaCards.error || !userAIdeaCards.data?.length) {
    throw userAIdeaCards.error ?? new Error("Expected User A to read own idea cards through RLS");
  }
  const userAIdeationRuns = await userASupabase
    .from("project_ideation_runs")
    .select("id,project_id,task_query")
    .eq("project_id", projectId);
  if (userAIdeationRuns.error || !userAIdeationRuns.data?.length) {
    throw userAIdeationRuns.error ?? new Error("Expected User A to read own ideation runs through RLS");
  }
  const userBIdeaCards = await userBSupabase
    .from("project_idea_cards")
    .select("id,title,project_id,source_grounding_note")
    .eq("project_id", projectId);
  if (userBIdeaCards.error) throw userBIdeaCards.error;
  if (userBIdeaCards.data.length) {
    throw new Error("User B could read User A idea cards through RLS");
  }
  const userBIdeationRuns = await userBSupabase
    .from("project_ideation_runs")
    .select("id,project_id,task_query")
    .eq("project_id", projectId);
  if (userBIdeationRuns.error) throw userBIdeationRuns.error;
  if (userBIdeationRuns.data.length) {
    throw new Error("User B could read User A ideation runs through RLS");
  }

  const evaluationChecks = {};
  const requiredEvaluationFields = [
    "overall_verdict",
    "strongest_aspect",
    "weakest_aspect",
    "scores_json",
    "overall_sharpness_score",
    "genericness_risk_score",
    "development_readiness",
    "source_grounding_assessment",
    "unsupported_claims",
    "feasibility_risks",
    "sharpness_suggestions",
    "recommended_action"
  ];
  const requiredScoreKeys = [
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
  const evaluateIdeas = async (evaluationMode, ideaIds) => {
    const result = await request(`/api/projects/${projectId}/idea-evaluations/generate`, {
      method: "POST",
      body: JSON.stringify({
        query: `Evaluate sourcepack ideas using ${evaluationMode}. Flag genericness, unsupported claims, mandatory rule risk, and inspiration-as-proof mistakes.`,
        idea_card_ids: ideaIds,
        dossier_id: generatedDossier.dossier.id,
        evaluation_mode: evaluationMode,
        retrieval_scope: "project_plus_global",
        retrieval_mode: "semantic",
        source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
        source_types: ["text"],
        max_total_chunks: 8
      })
    });
    if (result.evaluations.length !== ideaIds.length) {
      throw new Error(`Expected ${evaluationMode} to evaluate requested ideas`);
    }
    for (const evaluation of result.evaluations) {
      for (const field of requiredEvaluationFields) {
        if (evaluation[field] === undefined || evaluation[field] === null) {
          throw new Error(`Expected evaluation field ${field}`);
        }
      }
      for (const key of requiredScoreKeys) {
        const score = evaluation.scores_json[key];
        if (!Number.isInteger(score) || score < 1 || score > 5) {
          throw new Error(`Expected valid score for ${key}`);
        }
      }
      if (
        !Number.isInteger(evaluation.overall_sharpness_score) ||
        evaluation.overall_sharpness_score < 1 ||
        evaluation.overall_sharpness_score > 10
      ) {
        throw new Error("Expected valid overall sharpness score");
      }
      if (
        !Number.isInteger(evaluation.genericness_risk_score) ||
        evaluation.genericness_risk_score < 1 ||
        evaluation.genericness_risk_score > 10
      ) {
        throw new Error("Expected valid genericness risk score");
      }
      if (!["Low", "Medium", "High"].includes(evaluation.development_readiness)) {
        throw new Error("Expected valid development readiness");
      }
      if (!["Reject", "Revise", "Shortlist", "Develop", "Park for later"].includes(evaluation.recommended_action)) {
        throw new Error("Expected valid recommended action");
      }
    }
    evaluationChecks[evaluationMode] = result.evaluations.length;
    return result.evaluations;
  };

  const strategicEvaluations = await evaluateIdeas("Strategic review", [
    generatedIdeas.ideas[0].id,
    generatedIdeas.ideas[1].id
  ]);
  await evaluateIdeas("Quick screen", [generatedIdeas.ideas[0].id]);
  await evaluateIdeas("Creative red-team", [generatedIdeas.ideas[0].id]);
  await evaluateIdeas("Commercial feasibility check", [generatedIdeas.ideas[0].id]);
  await evaluateIdeas("Anti-generic audit", [generatedIdeas.ideas[0].id]);

  const storedEvaluations = await request(`/api/projects/${projectId}/idea-evaluations`);
  if (!storedEvaluations.evaluations.some((evaluation) => evaluation.id === strategicEvaluations[0].id)) {
    throw new Error("Expected stored idea evaluations to be listed");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/idea-evaluations`, userBCookie);
  await expectBlockedWithCookie(`/api/projects/${projectId}/idea-evaluations/generate`, userBCookie, {
    method: "POST",
    body: JSON.stringify({
      query: "Try to evaluate another user's ideas and source snippets",
      idea_card_ids: [generatedIdeas.ideas[0].id],
      evaluation_mode: "Strategic review",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"]
    })
  });

  const userAEvaluations = await userASupabase
    .from("project_idea_evaluations")
    .select("id,project_id,idea_card_id,overall_verdict")
    .eq("project_id", projectId);
  if (userAEvaluations.error || !userAEvaluations.data?.length) {
    throw userAEvaluations.error ?? new Error("Expected User A to read own idea evaluations through RLS");
  }
  const userBEvaluations = await userBSupabase
    .from("project_idea_evaluations")
    .select("id,project_id,idea_card_id,overall_verdict")
    .eq("project_id", projectId);
  if (userBEvaluations.error) throw userBEvaluations.error;
  if (userBEvaluations.data.length) {
    throw new Error("User B could read User A idea evaluations through RLS");
  }
  const rejectedIdeaCard = await request(
    `/api/projects/${projectId}/idea-cards/${generatedIdeas.ideas[0].id}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason: "Too close to category wallpaper" })
    }
  );
  if (
    rejectedIdeaCard.idea.status !== "rejected" ||
    rejectedIdeaCard.idea.rejection_reason !== "Too close to category wallpaper"
  ) {
    throw new Error("Expected idea rejection reason to be stored");
  }
  const shortlistedIdeaCard = await request(
    `/api/projects/${projectId}/idea-cards/${generatedIdeas.ideas[1].id}/shortlist`,
    {
      method: "POST",
      body: JSON.stringify({ reason: "Has a sharp collision" })
    }
  );
  if (
    shortlistedIdeaCard.idea.status !== "shortlisted" ||
    shortlistedIdeaCard.idea.shortlist_reason !== "Has a sharp collision"
  ) {
    throw new Error("Expected idea shortlist reason to be stored");
  }

  const requiredRouteFields = [
    "idea_card_id",
    "route_depth",
    "route_title",
    "route_summary",
    "core_campaign_thought",
    "audience_tension",
    "category_pressure",
    "brand_product_truth",
    "brand_role",
    "non_generic_reason",
    "campaign_mechanics",
    "execution_system",
    "sample_touchpoints",
    "proof_needed",
    "risks",
    "feasibility_notes",
    "source_grounding_summary",
    "assumptions",
    "missing_context",
    "next_refinement_questions"
  ];
  const routeChecks = {};
  const developRoute = async ({ ideaId, evaluationId, routeDepth }) => {
    const result = await request(`/api/projects/${projectId}/routes/develop`, {
      method: "POST",
      body: JSON.stringify({
        query: `Develop a ${routeDepth} from this idea. Preserve proof gaps, assumptions, mandatory constraints, and inspiration-as-stimulus handling.`,
        idea_card_id: ideaId,
        dossier_id: generatedDossier.dossier.id,
        evaluation_id: evaluationId,
        route_depth: routeDepth,
        retrieval_scope: "project_plus_global",
        retrieval_mode: "semantic",
        source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
        source_types: ["text"],
        max_total_chunks: 8
      })
    });
    for (const field of requiredRouteFields) {
      if (result.route[field] === undefined || result.route[field] === null) {
        throw new Error(`Expected developed route field ${field}`);
      }
    }
    if (result.route.idea_card_id !== ideaId) {
      throw new Error("Expected developed route to link back to idea card");
    }
    if (evaluationId && result.route.evaluation_id !== evaluationId) {
      throw new Error("Expected developed route to link to evaluation");
    }
    if (result.route.dossier_id !== generatedDossier.dossier.id) {
      throw new Error("Expected developed route to link to dossier");
    }
    if (!result.route.campaign_mechanics.length || !result.route.assumptions.length) {
      throw new Error("Expected campaign mechanics and assumptions");
    }
    routeChecks[routeDepth] = (routeChecks[routeDepth] ?? 0) + 1;
    return result.route;
  };
  const standardRoute = await developRoute({
    ideaId: shortlistedIdeaCard.idea.id,
    evaluationId: strategicEvaluations.find((evaluation) => evaluation.idea_card_id === shortlistedIdeaCard.idea.id)?.id,
    routeDepth: "Standard route"
  });
  const lightRoute = await developRoute({
    ideaId: generatedIdeas.ideas[2].id,
    evaluationId: undefined,
    routeDepth: "Light route"
  });
  const deepRoute = await developRoute({
    ideaId: generatedIdeas.ideas[2].id,
    evaluationId: undefined,
    routeDepth: "Deep route"
  });
  const routeNote = await request(`/api/projects/${projectId}/routes/${standardRoute.id}/revision-notes`, {
    method: "POST",
    body: JSON.stringify({ note: "Smoke route revision note" })
  });
  if (routeNote.note.note !== "Smoke route revision note") {
    throw new Error("Expected route revision note to be stored");
  }
  const routeNotes = await request(`/api/projects/${projectId}/route-revision-notes`);
  if (!routeNotes.notes.some((note) => note.id === routeNote.note.id)) {
    throw new Error("Expected route revision note to be listed");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/routes/develop`, userBCookie, {
    method: "POST",
    body: JSON.stringify({
      query: "Try to develop another user's idea into a route",
      idea_card_id: shortlistedIdeaCard.idea.id,
      route_depth: "Standard route",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"]
    })
  });
  await expectBlockedWithCookie(`/api/projects/${projectId}/workspace`, userBCookie);
  await expectBlockedWithCookie(`/api/projects/${projectId}/route-revision-notes`, userBCookie);
  await expectBlockedWithCookie(
    `/api/projects/${projectId}/routes/${standardRoute.id}/revision-notes`,
    userBCookie,
    {
      method: "POST",
      body: JSON.stringify({ note: "Should be blocked" })
    }
  );
  const userARoutes = await userASupabase
    .from("routes")
    .select("id,project_id,idea_card_id,route_title")
    .eq("project_id", projectId);
  if (userARoutes.error || !userARoutes.data?.some((route) => route.id === standardRoute.id)) {
    throw userARoutes.error ?? new Error("Expected User A to read own developed routes through RLS");
  }
  const userBRoutes = await userBSupabase
    .from("routes")
    .select("id,project_id,idea_card_id,route_title")
    .eq("project_id", projectId);
  if (userBRoutes.error) throw userBRoutes.error;
  if (userBRoutes.data.length) {
    throw new Error("User B could read User A developed routes through RLS");
  }
  const userANotes = await userASupabase
    .from("route_revision_notes")
    .select("id,project_id,route_id,note")
    .eq("project_id", projectId);
  if (userANotes.error || !userANotes.data?.some((note) => note.id === routeNote.note.id)) {
    throw userANotes.error ?? new Error("Expected User A to read own route notes through RLS");
  }
  const userBNotes = await userBSupabase
    .from("route_revision_notes")
    .select("id,project_id,route_id,note")
    .eq("project_id", projectId);
  if (userBNotes.error) throw userBNotes.error;
  if (userBNotes.data.length) {
    throw new Error("User B could read User A route notes through RLS");
  }
  const firstFinalSelection = await request(`/api/projects/${projectId}/final-truth`, {
    method: "PUT",
    body: JSON.stringify({
      developed_route_id: standardRoute.id,
      final_route_title: "Smoke standard final route",
      final_campaign_truth: "The campaign truth is that visible proof makes momentum feel possible.",
      selection_rationale: "The standard route has the strongest balance of evidence, tension, and actionability.",
      why_this_route_won: "It links the shortlisted idea to proof gaps and a clear brand role.",
      rejected_or_deprioritised_notes: "Light route lacked enough decision depth; deep route added detail not needed yet.",
      proof_required: standardRoute.proof_needed,
      risks_watchouts: standardRoute.risks,
      assumptions: standardRoute.assumptions.join("\n"),
      missing_context: standardRoute.missing_context.join("\n"),
      next_action: "Prepare campaign expansion inputs"
    })
  });
  if (
    firstFinalSelection.finalTruth.developed_route_id !== standardRoute.id ||
    firstFinalSelection.finalTruth.idea_card_id !== standardRoute.idea_card_id ||
    firstFinalSelection.finalTruth.evaluation_id !== standardRoute.evaluation_id ||
    firstFinalSelection.finalTruth.dossier_id !== standardRoute.dossier_id ||
    firstFinalSelection.finalTruth.status !== "active" ||
    !firstFinalSelection.finalTruth.proof_required ||
    !firstFinalSelection.finalTruth.risks_watchouts
  ) {
    throw new Error("Expected final selection to store route traceability and decision fields");
  }
  const secondFinalSelection = await request(`/api/projects/${projectId}/final-truth`, {
    method: "PUT",
    body: JSON.stringify({
      developed_route_id: deepRoute.id,
      final_route_title: "Smoke deep final route",
      final_campaign_truth: "The chosen campaign truth is that progress feels sharper when proof is visible.",
      selection_rationale: "The deep route now wins because it preserves more strategic rationale.",
      why_this_route_won: "It has the richer internal decision record.",
      rejected_or_deprioritised_notes: "The standard route was superseded for deeper development readiness.",
      proof_required: deepRoute.proof_needed,
      risks_watchouts: deepRoute.risks,
      assumptions: deepRoute.assumptions.join("\n"),
      missing_context: deepRoute.missing_context.join("\n"),
      next_action: "Lock expansion brief"
    })
  });
  if (
    secondFinalSelection.finalTruth.developed_route_id !== deepRoute.id ||
    secondFinalSelection.finalTruth.status !== "active"
  ) {
    throw new Error("Expected second final selection to become active");
  }
  const finalWorkspace = await request(`/api/projects/${projectId}/workspace`);
  const finalSelections = finalWorkspace.workspace.finalSelections ?? [];
  const supersededSelection = finalSelections.find(
    (selection) => selection.id === firstFinalSelection.finalTruth.id
  );
  if (
    finalWorkspace.workspace.finalTruth.id !== secondFinalSelection.finalTruth.id ||
    finalSelections.length < 2 ||
    supersededSelection?.status !== "superseded" ||
    supersededSelection?.superseded_by !== secondFinalSelection.finalTruth.id
  ) {
    throw new Error("Expected final selection history to preserve superseded rows");
  }
  const requiredBlueprintFields = [
    "final_selection_id",
    "developed_route_id",
    "blueprint_title",
    "selected_campaign_truth",
    "route_summary",
    "strategic_problem",
    "audience_tension",
    "category_pressure",
    "brand_product_truth",
    "brand_role",
    "campaign_platform_statement",
    "campaign_promise",
    "message_hierarchy",
    "core_narrative_arc",
    "execution_pillars",
    "campaign_mechanics",
    "touchpoint_system",
    "proof_stack_required",
    "assets_formats_to_explore",
    "rollout_logic",
    "risks_watchouts",
    "feasibility_notes",
    "assumptions",
    "missing_context",
    "open_questions",
    "next_recommended_action"
  ];
  const blueprintChecks = {};
  const generateBlueprint = async (blueprintDepth) => {
    const result = await request(`/api/projects/${projectId}/campaign-blueprints/generate`, {
      method: "POST",
      body: JSON.stringify({
        query: `Generate a ${blueprintDepth} from the active final selection. Keep proof gaps, assumptions, mandatory rules, and inspiration-as-stimulus handling visible.`,
        final_selection_id: secondFinalSelection.finalTruth.id,
        developed_route_id: deepRoute.id,
        dossier_id: deepRoute.dossier_id,
        evaluation_id: deepRoute.evaluation_id ?? undefined,
        idea_card_id: deepRoute.idea_card_id,
        blueprint_depth: blueprintDepth,
        retrieval_scope: "project_plus_global",
        retrieval_mode: "semantic",
        source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
        source_types: ["text"],
        max_total_chunks: 8
      })
    });
    for (const field of requiredBlueprintFields) {
      if (result.blueprint[field] === undefined || result.blueprint[field] === null) {
        throw new Error(`Expected campaign blueprint field ${field}`);
      }
    }
    if (
      result.blueprint.final_selection_id !== secondFinalSelection.finalTruth.id ||
      result.blueprint.developed_route_id !== deepRoute.id ||
      result.blueprint.dossier_id !== deepRoute.dossier_id ||
      result.blueprint.blueprint_depth !== blueprintDepth ||
      !Object.keys(result.blueprint.message_hierarchy).length ||
      !result.blueprint.execution_pillars.length ||
      !result.blueprint.touchpoint_system.length ||
      !result.blueprint.proof_stack_required.length ||
      !result.blueprint.assumptions.length ||
      !result.blueprint.missing_context.length
    ) {
      throw new Error("Expected campaign blueprint traceability and required structure");
    }
    blueprintChecks[blueprintDepth] = (blueprintChecks[blueprintDepth] ?? 0) + 1;
    return result.blueprint;
  };
  const leanBlueprint = await generateBlueprint("Lean blueprint");
  const standardBlueprint = await generateBlueprint("Standard blueprint");
  const detailedBlueprint = await generateBlueprint("Detailed blueprint");
  const blueprintNote = await request(`/api/projects/${projectId}/campaign-blueprints/${standardBlueprint.id}/revision-notes`, {
    method: "POST",
    body: JSON.stringify({ note: "Smoke campaign blueprint revision note" })
  });
  if (blueprintNote.note.note !== "Smoke campaign blueprint revision note") {
    throw new Error("Expected campaign blueprint revision note to be stored");
  }
  const blueprintNotes = await request(`/api/projects/${projectId}/campaign-blueprint-revision-notes`);
  if (!blueprintNotes.notes.some((note) => note.id === blueprintNote.note.id)) {
    throw new Error("Expected campaign blueprint revision note to be listed");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/campaign-blueprints/generate`, userBCookie, {
    method: "POST",
    body: JSON.stringify({
      query: "Try to generate another user's campaign blueprint",
      final_selection_id: secondFinalSelection.finalTruth.id,
      developed_route_id: deepRoute.id,
      blueprint_depth: "Standard blueprint",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"]
    })
  });
  await expectBlockedWithCookie(`/api/projects/${projectId}/campaign-blueprint-revision-notes`, userBCookie);
  await expectBlockedWithCookie(
    `/api/projects/${projectId}/campaign-blueprints/${standardBlueprint.id}/revision-notes`,
    userBCookie,
    {
      method: "POST",
      body: JSON.stringify({ note: "Should be blocked" })
    }
  );
  const userABlueprints = await userASupabase
    .from("project_campaign_blueprints")
    .select("id,project_id,final_selection_id,developed_route_id,blueprint_title")
    .eq("project_id", projectId);
  if (userABlueprints.error || !userABlueprints.data?.some((blueprint) => blueprint.id === standardBlueprint.id)) {
    throw userABlueprints.error ?? new Error("Expected User A to read own campaign blueprints through RLS");
  }
  const userBBlueprints = await userBSupabase
    .from("project_campaign_blueprints")
    .select("id,project_id,final_selection_id,developed_route_id,blueprint_title")
    .eq("project_id", projectId);
  if (userBBlueprints.error) throw userBBlueprints.error;
  if (userBBlueprints.data.length) {
    throw new Error("User B could read User A campaign blueprints through RLS");
  }
  const userABlueprintNotes = await userASupabase
    .from("campaign_blueprint_revision_notes")
    .select("id,project_id,blueprint_id,note")
    .eq("project_id", projectId);
  if (userABlueprintNotes.error || !userABlueprintNotes.data?.some((note) => note.id === blueprintNote.note.id)) {
    throw userABlueprintNotes.error ?? new Error("Expected User A to read own campaign blueprint notes through RLS");
  }
  const userBBlueprintNotes = await userBSupabase
    .from("campaign_blueprint_revision_notes")
    .select("id,project_id,blueprint_id,note")
    .eq("project_id", projectId);
  if (userBBlueprintNotes.error) throw userBBlueprintNotes.error;
  if (userBBlueprintNotes.data.length) {
    throw new Error("User B could read User A campaign blueprint notes through RLS");
  }
  const requiredHandoffFields = [
    "campaign_blueprint_id",
    "handoff_type",
    "deck_depth",
    "audience_type",
    "deck_purpose",
    "core_campaign_truth",
    "narrative_arc",
    "slide_structure",
    "section_breaks",
    "visual_design_notes",
    "proof_claim_control",
    "open_questions",
    "copy_paste_handoff",
    "source_grounding_summary",
    "assumptions",
    "missing_context",
    "internal_only_notes"
  ];
  const handoffChecks = {};
  const deckDepthChecks = {};
  const audienceChecks = {};
  const generateHandoff = async ({ handoffType, deckDepth, audienceType }) => {
    const result = await request(`/api/projects/${projectId}/pitch-deck-handoffs/generate`, {
      method: "POST",
      body: JSON.stringify({
        query: `Create a ${deckDepth} ${handoffType} for ${audienceType}. Keep proof gaps, assumptions, internal-only notes, and no-PPT boundary visible.`,
        campaign_blueprint_id: standardBlueprint.id,
        final_selection_id: standardBlueprint.final_selection_id,
        developed_route_id: standardBlueprint.developed_route_id,
        handoff_type: handoffType,
        deck_depth: deckDepth,
        audience_type: audienceType,
        retrieval_scope: "project_plus_global",
        retrieval_mode: "semantic",
        source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
        source_types: ["text"],
        max_total_chunks: 8
      })
    });
    for (const field of requiredHandoffFields) {
      if (result.handoff[field] === undefined || result.handoff[field] === null) {
        throw new Error(`Expected pitch deck handoff field ${field}`);
      }
    }
    if (
      result.handoff.campaign_blueprint_id !== standardBlueprint.id ||
      result.handoff.final_selection_id !== standardBlueprint.final_selection_id ||
      result.handoff.developed_route_id !== standardBlueprint.developed_route_id ||
      result.handoff.handoff_type !== handoffType ||
      result.handoff.deck_depth !== deckDepth ||
      result.handoff.audience_type !== audienceType ||
      !result.handoff.slide_structure.length ||
      !Object.keys(result.handoff.narrative_arc).length ||
      !Object.keys(result.handoff.proof_claim_control).length ||
      !Object.keys(result.handoff.visual_design_notes).length ||
      !result.handoff.copy_paste_handoff.includes("PPT") ||
      !result.handoff.assumptions.length ||
      !result.handoff.missing_context.length ||
      !result.handoff.internal_only_notes.length
    ) {
      throw new Error("Expected pitch deck handoff traceability and required structure");
    }
    handoffChecks[handoffType] = (handoffChecks[handoffType] ?? 0) + 1;
    deckDepthChecks[deckDepth] = (deckDepthChecks[deckDepth] ?? 0) + 1;
    audienceChecks[audienceType] = (audienceChecks[audienceType] ?? 0) + 1;
    return result.handoff;
  };
  const internalHandoff = await generateHandoff({
    handoffType: "Internal pitch structure",
    deckDepth: "Short deck",
    audienceType: "Internal team"
  });
  const clientHandoff = await generateHandoff({
    handoffType: "Client pitch structure",
    deckDepth: "Standard deck",
    audienceType: "Client leadership"
  });
  const founderHandoff = await generateHandoff({
    handoffType: "Founder review structure",
    deckDepth: "Detailed deck",
    audienceType: "B2B boardroom"
  });
  const creativeHandoff = await generateHandoff({
    handoffType: "Creative team handoff",
    deckDepth: "Standard deck",
    audienceType: "Creative review"
  });
  const pptHandoff = await generateHandoff({
    handoffType: "PPT design team handoff",
    deckDepth: "Standard deck",
    audienceType: "Marketing team"
  });
  const handoffNote = await request(`/api/projects/${projectId}/pitch-deck-handoffs/${pptHandoff.id}/revision-notes`, {
    method: "POST",
    body: JSON.stringify({ note: "Smoke pitch deck handoff revision note" })
  });
  if (handoffNote.note.note !== "Smoke pitch deck handoff revision note") {
    throw new Error("Expected pitch deck handoff revision note to be stored");
  }
  const handoffNotes = await request(`/api/projects/${projectId}/pitch-deck-handoff-revision-notes`);
  if (!handoffNotes.notes.some((note) => note.id === handoffNote.note.id)) {
    throw new Error("Expected pitch deck handoff revision note to be listed");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/pitch-deck-handoffs/generate`, userBCookie, {
    method: "POST",
    body: JSON.stringify({
      query: "Try to generate another user's pitch deck handoff",
      campaign_blueprint_id: standardBlueprint.id,
      handoff_type: "PPT design team handoff",
      deck_depth: "Standard deck",
      audience_type: "Client leadership",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"]
    })
  });
  await expectBlockedWithCookie(`/api/projects/${projectId}/pitch-deck-handoff-revision-notes`, userBCookie);
  await expectBlockedWithCookie(
    `/api/projects/${projectId}/pitch-deck-handoffs/${pptHandoff.id}/revision-notes`,
    userBCookie,
    {
      method: "POST",
      body: JSON.stringify({ note: "Should be blocked" })
    }
  );
  const userAHandoffs = await userASupabase
    .from("project_pitch_deck_handoffs")
    .select("id,project_id,campaign_blueprint_id,copy_paste_handoff")
    .eq("project_id", projectId);
  if (userAHandoffs.error || !userAHandoffs.data?.some((handoff) => handoff.id === pptHandoff.id)) {
    throw userAHandoffs.error ?? new Error("Expected User A to read own pitch deck handoffs through RLS");
  }
  const userBHandoffs = await userBSupabase
    .from("project_pitch_deck_handoffs")
    .select("id,project_id,campaign_blueprint_id,copy_paste_handoff")
    .eq("project_id", projectId);
  if (userBHandoffs.error) throw userBHandoffs.error;
  if (userBHandoffs.data.length) {
    throw new Error("User B could read User A pitch deck handoffs through RLS");
  }
  const userAHandoffNotes = await userASupabase
    .from("pitch_deck_handoff_revision_notes")
    .select("id,project_id,handoff_id,note")
    .eq("project_id", projectId);
  if (userAHandoffNotes.error || !userAHandoffNotes.data?.some((note) => note.id === handoffNote.note.id)) {
    throw userAHandoffNotes.error ?? new Error("Expected User A to read own pitch deck handoff notes through RLS");
  }
  const userBHandoffNotes = await userBSupabase
    .from("pitch_deck_handoff_revision_notes")
    .select("id,project_id,handoff_id,note")
    .eq("project_id", projectId);
  if (userBHandoffNotes.error) throw userBHandoffNotes.error;
  if (userBHandoffNotes.data.length) {
    throw new Error("User B could read User A pitch deck handoff notes through RLS");
  }
  const requiredReviewFields = [
    "pitch_deck_handoff_id",
    "review_mode",
    "overall_readiness_verdict",
    "readiness_score",
    "client_readiness_status",
    "narrative_strength_assessment",
    "slide_logic_assessment",
    "proof_claim_risk_assessment",
    "unsupported_claims",
    "proof_gaps",
    "assumptions",
    "missing_context",
    "internal_only_risks",
    "visual_asset_gaps",
    "design_handoff_clarity_assessment",
    "recommended_fixes",
    "do_not_present_yet_warnings",
    "copy_paste_improvement_notes"
  ];
  const reviewChecks = {};
  const generateReview = async (reviewMode) => {
    const result = await request(`/api/projects/${projectId}/pitch-deck-handoff-reviews/generate`, {
      method: "POST",
      body: JSON.stringify({
        query: `Review this pitch deck handoff using ${reviewMode}. Flag proof gaps, internal-only content, unsupported claims, visual asset gaps, and slide-level risks.`,
        pitch_deck_handoff_id: pptHandoff.id,
        review_mode: reviewMode,
        retrieval_scope: "project_plus_global",
        retrieval_mode: "semantic",
        source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
        source_types: ["text"],
        max_total_chunks: 8
      })
    });
    for (const field of requiredReviewFields) {
      if (result.review[field] === undefined || result.review[field] === null) {
        throw new Error(`Expected pitch deck handoff review field ${field}`);
      }
    }
    if (
      result.review.pitch_deck_handoff_id !== pptHandoff.id ||
      result.review.campaign_blueprint_id !== pptHandoff.campaign_blueprint_id ||
      result.review.final_selection_id !== pptHandoff.final_selection_id ||
      result.review.developed_route_id !== pptHandoff.developed_route_id ||
      result.review.review_mode !== reviewMode ||
      typeof result.review.readiness_score !== "number" ||
      result.review.readiness_score < 0 ||
      result.review.readiness_score > 100 ||
      !result.review.proof_gaps.length ||
      !result.review.assumptions.length ||
      !result.review.missing_context.length ||
      !result.review.internal_only_risks.length ||
      !result.review.visual_asset_gaps.length ||
      !result.review.recommended_fixes.length ||
      !result.review.do_not_present_yet_warnings.length ||
      !result.slideReviews.length
    ) {
      throw new Error("Expected pitch deck handoff review traceability and required structure");
    }
    for (const slide of result.slideReviews) {
      for (const field of [
        "slide_number",
        "slide_title",
        "reviewer_readiness_status",
        "slide_job_clarity",
        "key_message_clarity",
        "narrative_fit",
        "proof_status",
        "claim_risk",
        "visual_asset_requirement",
        "client_input_requirement",
        "internal_only_concern",
        "genericness_risk",
        "recommended_fix",
        "presenter_risk_watchout",
        "final_recommendation"
      ]) {
        if (slide[field] === undefined || slide[field] === null) {
          throw new Error(`Expected slide review field ${field}`);
        }
      }
    }
    reviewChecks[reviewMode] = (reviewChecks[reviewMode] ?? 0) + 1;
    return result;
  };
  const quickReview = await generateReview("Quick readiness scan");
  const standardReview = await generateReview("Standard client-readiness review");
  const deepReview = await generateReview("Deep red-team review");
  const founderReview = await generateReview("Founder review");
  const reviewNote = await request(`/api/projects/${projectId}/pitch-deck-handoff-reviews/${standardReview.review.id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note: "Smoke pitch deck handoff review note" })
  });
  if (reviewNote.note.note !== "Smoke pitch deck handoff review note") {
    throw new Error("Expected pitch deck handoff review note to be stored");
  }
  const reviewNotes = await request(`/api/projects/${projectId}/pitch-deck-handoff-review-notes`);
  if (!reviewNotes.notes.some((note) => note.id === reviewNote.note.id)) {
    throw new Error("Expected pitch deck handoff review note to be listed");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/pitch-deck-handoff-reviews/generate`, userBCookie, {
    method: "POST",
    body: JSON.stringify({
      query: "Try to review another user's pitch deck handoff",
      pitch_deck_handoff_id: pptHandoff.id,
      review_mode: "Standard client-readiness review",
      retrieval_scope: "project_plus_global",
      retrieval_mode: "semantic",
      source_roles: ["context", "strategy", "inspiration", "evaluation", "mandatory_rule"],
      source_types: ["text"]
    })
  });
  await expectBlockedWithCookie(`/api/projects/${projectId}/pitch-deck-handoff-review-notes`, userBCookie);
  await expectBlockedWithCookie(
    `/api/projects/${projectId}/pitch-deck-handoff-reviews/${standardReview.review.id}/notes`,
    userBCookie,
    {
      method: "POST",
      body: JSON.stringify({ note: "Should be blocked" })
    }
  );
  const userAReviews = await userASupabase
    .from("pitch_deck_handoff_reviews")
    .select("id,project_id,pitch_deck_handoff_id,overall_readiness_verdict")
    .eq("project_id", projectId);
  if (userAReviews.error || !userAReviews.data?.some((review) => review.id === standardReview.review.id)) {
    throw userAReviews.error ?? new Error("Expected User A to read own pitch deck handoff reviews through RLS");
  }
  const userBReviews = await userBSupabase
    .from("pitch_deck_handoff_reviews")
    .select("id,project_id,pitch_deck_handoff_id,overall_readiness_verdict")
    .eq("project_id", projectId);
  if (userBReviews.error) throw userBReviews.error;
  if (userBReviews.data.length) {
    throw new Error("User B could read User A pitch deck handoff reviews through RLS");
  }
  const userASlideReviews = await userASupabase
    .from("pitch_deck_handoff_slide_reviews")
    .select("id,project_id,review_id,slide_number")
    .eq("project_id", projectId);
  if (userASlideReviews.error || !userASlideReviews.data?.some((slide) => slide.review_id === standardReview.review.id)) {
    throw userASlideReviews.error ?? new Error("Expected User A to read own slide reviews through RLS");
  }
  const userBSlideReviews = await userBSupabase
    .from("pitch_deck_handoff_slide_reviews")
    .select("id,project_id,review_id,slide_number")
    .eq("project_id", projectId);
  if (userBSlideReviews.error) throw userBSlideReviews.error;
  if (userBSlideReviews.data.length) {
    throw new Error("User B could read User A slide reviews through RLS");
  }
  const userAReviewNotes = await userASupabase
    .from("pitch_deck_handoff_review_notes")
    .select("id,project_id,review_id,note")
    .eq("project_id", projectId);
  if (userAReviewNotes.error || !userAReviewNotes.data?.some((note) => note.id === reviewNote.note.id)) {
    throw userAReviewNotes.error ?? new Error("Expected User A to read own review notes through RLS");
  }
  const userBReviewNotes = await userBSupabase
    .from("pitch_deck_handoff_review_notes")
    .select("id,project_id,review_id,note")
    .eq("project_id", projectId);
  if (userBReviewNotes.error) throw userBReviewNotes.error;
  if (userBReviewNotes.data.length) {
    throw new Error("User B could read User A review notes through RLS");
  }
  await expectBlockedWithCookie(`/api/projects/${projectId}/final-truth`, userBCookie, {
    method: "PUT",
    body: JSON.stringify({
      developed_route_id: standardRoute.id,
      final_route_title: "Blocked final route",
      final_campaign_truth: "Blocked truth",
      selection_rationale: "Should not be allowed",
      next_action: "Should fail"
    })
  });
  const userAFinalSelections = await userASupabase
    .from("final_campaign_truths")
    .select("id,project_id,developed_route_id,final_campaign_truth,status")
    .eq("project_id", projectId);
  if (
    userAFinalSelections.error ||
    !userAFinalSelections.data?.some((selection) => selection.id === secondFinalSelection.finalTruth.id)
  ) {
    throw userAFinalSelections.error ?? new Error("Expected User A to read own final selections through RLS");
  }
  const userBFinalSelections = await userBSupabase
    .from("final_campaign_truths")
    .select("id,project_id,developed_route_id,final_campaign_truth,status")
    .eq("project_id", projectId);
  if (userBFinalSelections.error) throw userBFinalSelections.error;
  if (userBFinalSelections.data.length) {
    throw new Error("User B could read User A final selections through RLS");
  }
  const blockedProjectSearchResponse = await fetch(
    `${baseUrl}/api/projects/00000000-0000-0000-0000-000000000000/source-search?q=source&scope=project`,
    { headers: { cookie } }
  );
  if (blockedProjectSearchResponse.status !== 404) {
    throw new Error("Expected blocked project search to return 404");
  }

  const imageUpload = await upload(
    `/api/projects/${projectId}/sources/upload`,
    {
      title: "Smoke image source",
      source_role: "context",
      source_type: "image",
      source_status: "active"
    },
    {
      name: "image.webp",
      type: "image/webp",
      content: new Uint8Array([82, 73, 73, 70, 0, 0, 0, 0, 87, 69, 66, 80])
    }
  );
  const imageProcessed = await request(
    `/api/projects/${projectId}/sources/${imageUpload.source.id}/process`,
    { method: "POST" }
  );
  if (imageProcessed.source.processing_status !== "unsupported") {
    throw new Error("Expected image source to be marked unsupported for OCR");
  }

  await expectUploadFailure(
    `/api/projects/${projectId}/sources/upload`,
    {
      title: "Blocked script",
      source_role: "context",
      source_type: "other",
      source_status: "active"
    },
    {
      name: "blocked.js",
      type: "text/javascript",
      content: "console.log('blocked')"
    }
  );

  await expectUploadFailure(
    `/api/projects/${projectId}/sources/upload`,
    {
      title: "Oversized",
      source_role: "context",
      source_type: "text",
      source_status: "active"
    },
    {
      name: "oversized.txt",
      type: "text/plain",
      content: new Uint8Array(26 * 1024 * 1024)
    }
  );

  await request(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke URL project source",
      description: "Project URL metadata source",
      source_role: "inspiration",
      source_type: "url",
      source_url: "https://example.com/project-source",
      tags: ["project", "url"],
      source_status: "active"
    })
  });

  const workspace = await request(`/api/projects/${projectId}/workspace`);
  const projectSources = await request(`/api/projects/${projectId}/sources`);
  if (
    workspace.workspace.notes.length < 1 ||
    workspace.workspace.rejectedIdeas.length < 1 ||
    workspace.workspace.shortlistedIdeas.length < 1 ||
    workspace.workspace.routes.length < 1 ||
    !workspace.workspace.finalTruth ||
    workspace.workspace.campaignBlueprints.length < 1 ||
    workspace.workspace.pitchDeckHandoffs.length < 1 ||
    workspace.workspace.pitchDeckHandoffReviews.length < 1 ||
    workspace.workspace.pitchDeckHandoffSlideReviews.length < 1
  ) {
    throw new Error("Expected Build 2 workspace data after creation");
  }
  if (projectSources.sources.length < 3) {
    throw new Error("Expected Build 3 project sources after creation");
  }
  if (!projectSources.sources.some((source) => source.storage_path && source.file_size)) {
    throw new Error("Expected uploaded project source file metadata");
  }

  const settings = await request("/api/settings");
  await request("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({
      default_research_depth: "Standard",
      monthly_usage_warning_level: settings.settings.monthly_usage_warning_level
    })
  });

  const sources = await request("/api/global-sources");
  await request(`/api/global-sources/${globalCreated.source.id}`, { method: "DELETE" });
  await request(`/api/global-sources/${globalUpload.source.id}`, { method: "DELETE" });

  console.log(
    JSON.stringify(
      {
        ok: true,
        storageMode: health.storageMode,
        authMode: health.authMode,
        supabaseConfigured: health.supabaseConfigured,
        projectId,
        messageCount: messages.messages.length,
        workspaceSections: {
          notes: workspace.workspace.notes.length,
          rejectedIdeas: workspace.workspace.rejectedIdeas.length,
          shortlistedIdeas: workspace.workspace.shortlistedIdeas.length,
          routes: workspace.workspace.routes.length,
          finalTruth: Boolean(workspace.workspace.finalTruth),
          campaignBlueprints: workspace.workspace.campaignBlueprints.length,
          pitchDeckHandoffs: workspace.workspace.pitchDeckHandoffs.length,
          pitchDeckHandoffReviews: workspace.workspace.pitchDeckHandoffReviews.length,
          pitchDeckHandoffSlideReviews: workspace.workspace.pitchDeckHandoffSlideReviews.length
        },
        projectSourceCount: projectSources.sources.length,
        searchResults: {
          project: projectSearch.results.length,
          global: globalSearch.results.length,
          combined: combinedSearch.results.length,
          semanticProject: semanticProjectSearch.results.length,
          semanticGlobal: semanticGlobalSearch.results.length,
          semanticCombined: semanticCombinedSearch.results.length
        },
        contextPacks: {
          project: projectContextPack.contextPack.total_chunks,
          global: globalContextPack.contextPack.total_chunks,
          combined: combinedContextPack.contextPack.total_chunks
        },
        dossierSections: dossierSections.length,
        ideaCards: generatedIdeas.ideas.length,
        braveryChecks,
        ideationRls: {
          userAOwnIdeaCards: userAIdeaCards.data.length,
          userAOwnRuns: userAIdeationRuns.data.length,
          userBCrossIdeaCards: userBIdeaCards.data.length,
          userBCrossRuns: userBIdeationRuns.data.length
        },
        ideaEvaluations: storedEvaluations.evaluations.length,
        evaluationChecks,
        evaluationRls: {
          userAOwnEvaluations: userAEvaluations.data.length,
          userBCrossEvaluations: userBEvaluations.data.length
        },
        developedRoutes: {
          routeChecks,
          standardRoute: standardRoute.id,
          lightRoute: lightRoute.id,
          deepRoute: deepRoute.id,
          revisionNotes: routeNotes.notes.length
        },
        routeRls: {
          userAOwnRoutes: userARoutes.data.length,
          userBCrossRoutes: userBRoutes.data.length,
          userAOwnNotes: userANotes.data.length,
          userBCrossNotes: userBNotes.data.length
        },
        finalRouteSelection: {
          activeSelection: secondFinalSelection.finalTruth.id,
          selectedRoute: secondFinalSelection.finalTruth.developed_route_id,
          historyCount: finalSelections.length,
          supersededSelection: supersededSelection?.id,
          userAOwnSelections: userAFinalSelections.data.length,
          userBCrossSelections: userBFinalSelections.data.length
        },
        campaignBlueprints: {
          blueprintChecks,
          leanBlueprint: leanBlueprint.id,
          standardBlueprint: standardBlueprint.id,
          detailedBlueprint: detailedBlueprint.id,
          revisionNotes: blueprintNotes.notes.length
        },
        blueprintRls: {
          userAOwnBlueprints: userABlueprints.data.length,
          userBCrossBlueprints: userBBlueprints.data.length,
          userAOwnNotes: userABlueprintNotes.data.length,
          userBCrossNotes: userBBlueprintNotes.data.length
        },
        pitchDeckHandoffs: {
          handoffChecks,
          deckDepthChecks,
          audienceChecks,
          internalHandoff: internalHandoff.id,
          clientHandoff: clientHandoff.id,
          founderHandoff: founderHandoff.id,
          creativeHandoff: creativeHandoff.id,
          pptHandoff: pptHandoff.id,
          revisionNotes: handoffNotes.notes.length
        },
        handoffRls: {
          userAOwnHandoffs: userAHandoffs.data.length,
          userBCrossHandoffs: userBHandoffs.data.length,
          userAOwnNotes: userAHandoffNotes.data.length,
          userBCrossNotes: userBHandoffNotes.data.length
        },
        pitchDeckHandoffReviews: {
          reviewChecks,
          quickReview: quickReview.review.id,
          standardReview: standardReview.review.id,
          deepReview: deepReview.review.id,
          founderReview: founderReview.review.id,
          reviewNotes: reviewNotes.notes.length,
          standardSlideReviews: standardReview.slideReviews.length
        },
        handoffReviewRls: {
          userAOwnReviews: userAReviews.data.length,
          userBCrossReviews: userBReviews.data.length,
          userAOwnSlideReviews: userASlideReviews.data.length,
          userBCrossSlideReviews: userBSlideReviews.data.length,
          userAOwnNotes: userAReviewNotes.data.length,
          userBCrossNotes: userBReviewNotes.data.length
        },
        globalSourceCount: sources.sources.length
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (supabaseAdminForCleanup && userBIdForCleanup) {
      supabaseAdminForCleanup.auth.admin.deleteUser(userBIdForCleanup).catch(() => undefined);
    }
    server.kill("SIGTERM");
  });
