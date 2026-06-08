import type {
  DevelopedRoute,
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
  FinalCampaignTruth,
  FinalRouteSelectionInput,
  GlobalSource,
  Project,
  ProjectCreateInput,
  ProjectMessage,
  ProjectNote,
  RouteDevelopInput,
  RouteRevisionNote,
  ProjectWorkspaceData,
  ProjectSource,
  RejectedIdea,
  Settings,
  ShortlistedIdea,
  ContextPack,
  ContextPackInput,
  DossierGenerateInput,
  IdeationGenerateInput,
  IdeaEvaluationGenerateInput,
  ProjectDossier,
  ProjectIdeaCard,
  ProjectIdeaEvaluation,
  SourceInput,
  SourceSearchInput,
  SourceSearchResult,
  SourceContentSummary,
  SourceChunk,
  User
} from "@momentum-lab/shared";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function sourceFormData(input: SourceInput, file: File) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", input.title);
  formData.set("description", input.description ?? "");
  formData.set("source_role", input.source_role ?? "context");
  formData.set("source_type", input.source_type ?? "other");
  formData.set("source_status", input.source_status ?? "active");
  formData.set("source_url", input.source_url ?? "");
  formData.set("content_text", input.content_text ?? "");
  formData.set("tags", (input.tags ?? []).join(","));
  return formData;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User | null }>("/api/auth/me"),
  listProjects: () => request<{ projects: Project[] }>("/api/projects"),
  createProject: (input: ProjectCreateInput) =>
    request<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getProject: (id: string) => request<{ project: Project }>(`/api/projects/${id}`),
  updateProject: (id: string, input: Partial<ProjectCreateInput>) =>
    request<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  getWorkspace: (id: string) =>
    request<{ workspace: ProjectWorkspaceData }>(`/api/projects/${id}/workspace`),
  createNote: (id: string, content: string) =>
    request<{ note: ProjectNote }>(`/api/projects/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  updateNote: (projectId: string, noteId: string, content: string) =>
    request<{ note: ProjectNote }>(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ content })
    }),
  deleteNote: (projectId: string, noteId: string) =>
    request<void>(`/api/projects/${projectId}/notes/${noteId}`, {
      method: "DELETE"
    }),
  createRejectedIdea: (
    id: string,
    input: { title: string; idea_text?: string; reason_for_rejection?: string }
  ) =>
    request<{ idea: RejectedIdea }>(`/api/projects/${id}/rejected-ideas`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  createShortlistedIdea: (
    id: string,
    input: { title: string; idea_text?: string; why_shortlisted?: string }
  ) =>
    request<{ idea: ShortlistedIdea }>(`/api/projects/${id}/shortlisted-ideas`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  createRoute: (
    id: string,
    input: {
      route_title: string;
      core_thought?: string;
      audience_tension?: string;
      brand_role?: string;
      execution_notes?: string;
      risks?: string;
    }
  ) =>
    request<{ route: DevelopedRoute }>(`/api/projects/${id}/routes`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  developRoute: (id: string, input: RouteDevelopInput) =>
    request<{ route: DevelopedRoute }>(`/api/projects/${id}/routes/develop`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  listRouteRevisionNotes: (id: string) =>
    request<{ notes: RouteRevisionNote[] }>(`/api/projects/${id}/route-revision-notes`),
  createRouteRevisionNote: (projectId: string, routeId: string, note: string) =>
    request<{ note: RouteRevisionNote }>(
      `/api/projects/${projectId}/routes/${routeId}/revision-notes`,
      {
        method: "POST",
        body: JSON.stringify({ note })
      }
    ),
  generateCampaignBlueprint: (id: string, input: CampaignBlueprintGenerateInput) =>
    request<{ blueprint: CampaignBlueprint }>(`/api/projects/${id}/campaign-blueprints/generate`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  listCampaignBlueprintRevisionNotes: (id: string) =>
    request<{ notes: CampaignBlueprintRevisionNote[] }>(`/api/projects/${id}/campaign-blueprint-revision-notes`),
  createCampaignBlueprintRevisionNote: (projectId: string, blueprintId: string, note: string) =>
    request<{ note: CampaignBlueprintRevisionNote }>(
      `/api/projects/${projectId}/campaign-blueprints/${blueprintId}/revision-notes`,
      {
        method: "POST",
        body: JSON.stringify({ note })
      }
    ),
  generatePitchDeckHandoff: (id: string, input: PitchDeckHandoffGenerateInput) =>
    request<{ handoff: PitchDeckHandoff }>(`/api/projects/${id}/pitch-deck-handoffs/generate`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  listPitchDeckHandoffRevisionNotes: (id: string) =>
    request<{ notes: PitchDeckHandoffRevisionNote[] }>(`/api/projects/${id}/pitch-deck-handoff-revision-notes`),
  createPitchDeckHandoffRevisionNote: (projectId: string, handoffId: string, note: string) =>
    request<{ note: PitchDeckHandoffRevisionNote }>(
      `/api/projects/${projectId}/pitch-deck-handoffs/${handoffId}/revision-notes`,
      {
        method: "POST",
        body: JSON.stringify({ note })
      }
    ),
  generatePitchDeckHandoffReview: (id: string, input: PitchDeckHandoffReviewGenerateInput) =>
    request<{ review: PitchDeckHandoffReview; slideReviews: PitchDeckHandoffSlideReview[] }>(
      `/api/projects/${id}/pitch-deck-handoff-reviews/generate`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  listPitchDeckHandoffReviewNotes: (id: string) =>
    request<{ notes: PitchDeckHandoffReviewNote[] }>(`/api/projects/${id}/pitch-deck-handoff-review-notes`),
  createPitchDeckHandoffReviewNote: (projectId: string, reviewId: string, note: string) =>
    request<{ note: PitchDeckHandoffReviewNote }>(
      `/api/projects/${projectId}/pitch-deck-handoff-reviews/${reviewId}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ note })
      }
    ),
  saveFinalTruth: (
    id: string,
    input: FinalRouteSelectionInput & { route_id?: string | null; rationale?: string }
  ) =>
    request<{ finalTruth: FinalCampaignTruth }>(`/api/projects/${id}/final-truth`, {
      method: "PUT",
      body: JSON.stringify(input)
    }),
  listProjectSources: (id: string) =>
    request<{ sources: ProjectSource[] }>(`/api/projects/${id}/sources`),
  searchProjectSources: (id: string, input: SourceSearchInput) =>
    request<{ results: SourceSearchResult[] }>(
      `/api/projects/${id}/source-search?${searchParams(input)}`
    ),
  generateProjectContextPack: (id: string, input: ContextPackInput) =>
    request<{ contextPack: ContextPack }>(`/api/projects/${id}/context-pack`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  listProjectDossiers: (id: string) =>
    request<{ dossiers: ProjectDossier[] }>(`/api/projects/${id}/dossiers`),
  generateProjectDossier: (id: string, input: DossierGenerateInput) =>
    request<{ dossier: ProjectDossier; contextPack: ContextPack }>(
      `/api/projects/${id}/dossiers`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  listProjectIdeaCards: (id: string) =>
    request<{ ideas: ProjectIdeaCard[] }>(`/api/projects/${id}/idea-cards`),
  generateProjectIdeaCards: (id: string, input: IdeationGenerateInput) =>
    request<{ ideas: ProjectIdeaCard[] }>(`/api/projects/${id}/idea-cards/generate`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  rejectProjectIdeaCard: (projectId: string, ideaId: string, reason: string) =>
    request<{ idea: ProjectIdeaCard }>(`/api/projects/${projectId}/idea-cards/${ideaId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason })
    }),
  shortlistProjectIdeaCard: (projectId: string, ideaId: string, reason: string) =>
    request<{ idea: ProjectIdeaCard }>(`/api/projects/${projectId}/idea-cards/${ideaId}/shortlist`, {
      method: "POST",
      body: JSON.stringify({ reason })
    }),
  listProjectIdeaEvaluations: (id: string) =>
    request<{ evaluations: ProjectIdeaEvaluation[] }>(`/api/projects/${id}/idea-evaluations`),
  generateProjectIdeaEvaluations: (id: string, input: IdeaEvaluationGenerateInput) =>
    request<{ evaluations: ProjectIdeaEvaluation[] }>(
      `/api/projects/${id}/idea-evaluations/generate`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    ),
  createProjectSource: (id: string, input: SourceInput) =>
    request<{ source: ProjectSource }>(`/api/projects/${id}/sources`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  uploadProjectSource: (id: string, input: SourceInput, file: File) =>
    uploadRequest<{ source: ProjectSource }>(
      `/api/projects/${id}/sources/upload`,
      sourceFormData(input, file)
    ),
  updateProjectSource: (projectId: string, sourceId: string, input: Partial<SourceInput>) =>
    request<{ source: ProjectSource }>(`/api/projects/${projectId}/sources/${sourceId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  archiveProjectSource: (projectId: string, sourceId: string) =>
    request<{ source: ProjectSource }>(`/api/projects/${projectId}/sources/${sourceId}`, {
      method: "DELETE"
    }),
  getProjectSourceDownloadUrl: (projectId: string, sourceId: string) =>
    request<{ signedUrl: string }>(`/api/projects/${projectId}/sources/${sourceId}/download`),
  processProjectSource: (projectId: string, sourceId: string) =>
    request<{ source: ProjectSource }>(`/api/projects/${projectId}/sources/${sourceId}/process`, {
      method: "POST"
    }),
  embedProjectSource: (projectId: string, sourceId: string, force = false) =>
    request<{ source: ProjectSource }>(`/api/projects/${projectId}/sources/${sourceId}/embed`, {
      method: "POST",
      body: JSON.stringify({ force })
    }),
  getProjectSourceContent: (projectId: string, sourceId: string) =>
    request<{ content: SourceContentSummary }>(
      `/api/projects/${projectId}/sources/${sourceId}/content`
    ),
  listProjectSourceChunks: (projectId: string, sourceId: string) =>
    request<{ chunks: SourceChunk[] }>(`/api/projects/${projectId}/sources/${sourceId}/chunks`),
  listMessages: (id: string) =>
    request<{ messages: ProjectMessage[] }>(`/api/projects/${id}/messages`),
  sendMessage: (id: string, content: string) =>
    request<{ messages: ProjectMessage[] }>(`/api/projects/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  listGlobalSources: () => request<{ sources: GlobalSource[] }>("/api/global-sources"),
  searchGlobalSources: (input: SourceSearchInput) =>
    request<{ results: SourceSearchResult[] }>(`/api/global-sources/search?${searchParams(input)}`),
  generateGlobalContextPack: (input: ContextPackInput) =>
    request<{ contextPack: ContextPack }>("/api/global-sources/context-pack", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  createGlobalSource: (input: SourceInput) =>
    request<{ source: GlobalSource }>("/api/global-sources", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  uploadGlobalSource: (input: SourceInput, file: File) =>
    uploadRequest<{ source: GlobalSource }>(
      "/api/global-sources/upload",
      sourceFormData(input, file)
    ),
  updateGlobalSource: (id: string, input: Partial<SourceInput>) =>
    request<{ source: GlobalSource }>(`/api/global-sources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  archiveGlobalSource: (id: string) =>
    request<{ source: GlobalSource }>(`/api/global-sources/${id}`, {
      method: "DELETE"
    }),
  getGlobalSourceDownloadUrl: (id: string) =>
    request<{ signedUrl: string }>(`/api/global-sources/${id}/download`),
  processGlobalSource: (id: string) =>
    request<{ source: GlobalSource }>(`/api/global-sources/${id}/process`, {
      method: "POST"
    }),
  embedGlobalSource: (id: string, force = false) =>
    request<{ source: GlobalSource }>(`/api/global-sources/${id}/embed`, {
      method: "POST",
      body: JSON.stringify({ force })
    }),
  getGlobalSourceContent: (id: string) =>
    request<{ content: SourceContentSummary }>(`/api/global-sources/${id}/content`),
  listGlobalSourceChunks: (id: string) =>
    request<{ chunks: SourceChunk[] }>(`/api/global-sources/${id}/chunks`),
  getSettings: () => request<{ settings: Settings }>("/api/settings")
};

function searchParams(input: SourceSearchInput) {
  const params = new URLSearchParams();
  params.set("q", input.q);
  if (input.scope) params.set("scope", input.scope);
  if (input.mode) params.set("mode", input.mode);
  if (input.source_role) params.set("source_role", input.source_role);
  if (input.source_type) params.set("source_type", input.source_type);
  if (input.limit) params.set("limit", String(input.limit));
  return params.toString();
}
