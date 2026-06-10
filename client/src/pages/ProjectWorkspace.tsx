import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FileUp, Globe2, LayoutDashboard, Paperclip, Plus, Save, Search, Send, Sparkles, Trash2 } from "lucide-react";
import {
  BRAVERY_LEVELS,
  BLUEPRINT_DEPTHS,
  DECK_AUDIENCE_TYPES,
  DECK_DEPTHS,
  EVALUATION_MODES,
  HANDOFF_REVIEW_MODES,
  PROJECT_STATUSES,
  PITCH_HANDOFF_TYPES,
  RESEARCH_DEPTHS,
  ROUTE_DEPTHS,
  SOURCE_ROLE_VALUES,
  SOURCE_TYPES,
  type BraveryLevel,
  type CampaignBlueprint,
  type CampaignBlueprintRevisionNote,
  type ContextPack,
  type DevelopedRoute,
  type FinalCampaignTruth,
  type ProjectDossier,
  type ProjectIdeaCard,
  type ProjectIdeaEvaluation,
  type ProjectMessage,
  type Project,
  type ProjectStatus,
  type ProjectWorkspaceData,
  type PitchDeckHandoff,
  type PitchDeckHandoffReview,
  type PitchDeckHandoffReviewNote,
  type PitchDeckHandoffRevisionNote,
  type RejectedIdea,
  type ResearchDepth,
  type RouteRevisionNote,
  type ShortlistedIdea
} from "@momentum-lab/shared";
import { api } from "../api";
import { FilterSelect, SearchResults, SourceManager } from "./KnowledgeVault";
import type { ProjectSource, SourceInput, SourceSearchResult } from "@momentum-lab/shared";

const blankWorkspace: ProjectWorkspaceData = {
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

export function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspace, setWorkspace] = useState<ProjectWorkspaceData>(blankWorkspace);
  const [sources, setSources] = useState<ProjectSource[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [projectDraft, setProjectDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.getProject(projectId),
      api.listProjects(),
      api.getWorkspace(projectId),
      api.listProjectSources(projectId),
      api.listMessages(projectId)
    ])
      .then(([projectResponse, projectsResponse, workspaceResponse, sourcesResponse, messagesResponse]) => {
        setProject(projectResponse.project);
        setProjects(projectsResponse.projects);
        setWorkspace(workspaceResponse.workspace);
        setSources(sourcesResponse.sources);
        setMessages(messagesResponse.messages);
        setProjectDraft(projectToDraft(projectResponse.project));
        setError(null);
      })
      .catch((error) => setError(error instanceof Error ? error.message : "Could not load workspace"))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Auto-poll while any project source is still processing or embedding
  useEffect(() => {
    if (!projectId) return undefined;
    const hasPending = sources.some(
      (s) =>
        s.processing_status === "queued" ||
        s.processing_status === "processing" ||
        s.embedding_status === "queued" ||
        s.embedding_status === "embedding"
    );
    if (!hasPending) return undefined;
    const timer = window.setInterval(() => {
      api.listProjectSources(projectId)
        .then(({ sources: updated }) => setSources(updated))
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [projectId, sources]);

  const finalDraft = useMemo(
    () => ({
      route_id: workspace.finalTruth?.route_id ?? "",
      developed_route_id: workspace.finalTruth?.developed_route_id ?? workspace.finalTruth?.route_id ?? "",
      final_route_title: workspace.finalTruth?.final_route_title ?? "",
      final_campaign_truth: workspace.finalTruth?.final_campaign_truth ?? "",
      selection_rationale: workspace.finalTruth?.selection_rationale ?? workspace.finalTruth?.rationale ?? "",
      why_this_route_won: workspace.finalTruth?.why_this_route_won ?? "",
      rejected_or_deprioritised_notes: workspace.finalTruth?.rejected_or_deprioritised_notes ?? "",
      proof_required: workspace.finalTruth?.proof_required ?? "",
      risks_watchouts: workspace.finalTruth?.risks_watchouts ?? "",
      assumptions: workspace.finalTruth?.assumptions ?? "",
      missing_context: workspace.finalTruth?.missing_context ?? "",
      next_action: workspace.finalTruth?.next_action ?? ""
    }),
    [workspace.finalTruth]
  );

  const reloadWorkspace = async () => {
    if (!projectId) return;
    const [projectResponse, workspaceResponse] = await Promise.all([
      api.getProject(projectId),
      api.getWorkspace(projectId)
    ]);
    setProject(projectResponse.project);
    setProjectDraft(projectToDraft(projectResponse.project));
    setWorkspace(workspaceResponse.workspace);
  };

  const reloadSources = async () => {
    if (!projectId) return;
    const { sources } = await api.listProjectSources(projectId);
    setSources(sources);
  };

  const saveProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    setSavingProject(true);
    try {
      const { project } = await api.updateProject(projectId, {
        project_name: projectDraft.project_name,
        client_name: projectDraft.client_name,
        category: projectDraft.category,
        market: projectDraft.market,
        audience: projectDraft.audience,
        objective: projectDraft.objective,
        known_constraints: projectDraft.known_constraints,
        desired_output_type: projectDraft.desired_output_type,
        brief_notes: projectDraft.brief_notes,
        bravery_level: projectDraft.bravery_level as BraveryLevel,
        research_depth: projectDraft.research_depth as ResearchDepth,
        status: projectDraft.status as ProjectStatus
      });
      setProject(project);
      setProjectDraft(projectToDraft(project));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save project");
    } finally {
      setSavingProject(false);
    }
  };

  const deleteCurrentProject = async () => {
    if (!projectId || !project) return;
    const confirmed = window.confirm(
      `Delete "${project.project_name}"? This permanently removes the project workspace, project sources, generated outputs, notes, and uploaded project files.`
    );
    if (!confirmed) return;

    setDeletingProject(true);
    try {
      await api.deleteProject(projectId);
      navigate("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete project");
      setDeletingProject(false);
    }
  };

  if (loading) {
    return <main className="px-5 py-8 text-slate-400">Loading Project Workspace...</main>;
  }

  if (error || !project || !projectId) {
    return <main className="px-5 py-8 text-red-300">{error ?? "Project not found"}</main>;
  }

  return (
    <main className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-panel/40 p-4 lg:border-b-0 lg:border-r">
        <Link className="sidebar-link" to="/">
          <LayoutDashboard size={18} />
          Dashboard
        </Link>
        <div className="mt-6">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-500">Projects</p>
          <div className="space-y-2">
            {projects.map((item) => (
              <Link
                className={item.id === project.id ? "sidebar-project active" : "sidebar-project"}
                key={item.id}
                to={`/projects/${item.id}`}
              >
                <span>{item.project_name}</span>
                <small>{item.status || item.current_stage}</small>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <section className="px-5 py-6">
        <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-500">Project Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">{project.project_name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="stage-pill">{project.status}</span>
            <span className="stage-pill">{project.bravery_level || "Sharp"}</span>
            <span className="stage-pill">{project.research_depth || "Standard"}</span>
            <button
              className="btn-secondary"
              type="button"
              disabled={deletingProject}
              onClick={deleteCurrentProject}
            >
              <Trash2 size={16} />
              {deletingProject ? "Deleting..." : "Delete project"}
            </button>
          </div>
        </header>

        <ProjectChatCommandCenter
          project={project}
          projectId={projectId}
          messages={messages}
          sources={sources}
          outputs={workspace}
          onMessagesChange={setMessages}
          onSourcesChange={setSources}
          onSourcesReload={reloadSources}
          onWorkspaceReload={reloadWorkspace}
        />

        <details className="workspace-section mt-5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Advanced workflow controls
          </summary>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <form className="workspace-section" onSubmit={saveProject}>
            <SectionTitle title="Project brief" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Project name" value={projectDraft.project_name} onChange={(value) => setDraft("project_name", value, setProjectDraft)} required />
              <Field label="Client name" value={projectDraft.client_name} onChange={(value) => setDraft("client_name", value, setProjectDraft)} />
              <Field label="Category" value={projectDraft.category} onChange={(value) => setDraft("category", value, setProjectDraft)} />
              <Field label="Market" value={projectDraft.market} onChange={(value) => setDraft("market", value, setProjectDraft)} />
            </div>
            <Field label="Audience" value={projectDraft.audience} onChange={(value) => setDraft("audience", value, setProjectDraft)} textarea />
            <Field label="Objective" value={projectDraft.objective} onChange={(value) => setDraft("objective", value, setProjectDraft)} textarea />
            <Field label="Known constraints" value={projectDraft.known_constraints} onChange={(value) => setDraft("known_constraints", value, setProjectDraft)} textarea />
            <Field label="Desired output type" value={projectDraft.desired_output_type} onChange={(value) => setDraft("desired_output_type", value, setProjectDraft)} />
            <Field label="Brief notes" value={projectDraft.brief_notes} onChange={(value) => setDraft("brief_notes", value, setProjectDraft)} textarea />
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="Bravery level" value={projectDraft.bravery_level} options={BRAVERY_LEVELS} onChange={(value) => setDraft("bravery_level", value, setProjectDraft)} />
              <SelectField label="Research depth" value={projectDraft.research_depth} options={RESEARCH_DEPTHS} onChange={(value) => setDraft("research_depth", value, setProjectDraft)} />
              <SelectField label="Status" value={projectDraft.status} options={PROJECT_STATUSES} onChange={(value) => setDraft("status", value, setProjectDraft)} />
            </div>
            <button className="btn-primary" disabled={savingProject}>
              <Save size={17} />
              {savingProject ? "Saving..." : "Save project details"}
            </button>
          </form>

          <div className="space-y-5">
            <IdeaExplorer projectId={projectId} />
            <IdeaEvaluation projectId={projectId} />
            <CreativeIntelligenceDossier projectId={projectId} />
            <ContextPackPreview projectId={projectId} />
            <ProjectSourceSearch projectId={projectId} />
            <ProjectSourcesSection
              projectId={projectId}
              sources={sources}
              onArchived={(sourceId) => setSources((current) => current.filter((source) => source.id !== sourceId))}
              onChange={reloadSources}
            />
            <NotesSection projectId={projectId} workspace={workspace} onChange={reloadWorkspace} />
            <FinalTruthSection projectId={projectId} workspace={workspace} initialDraft={finalDraft} onChange={reloadWorkspace} />
            <CampaignBlueprintSection projectId={projectId} workspace={workspace} onChange={reloadWorkspace} />
            <PitchDeckHandoffSection projectId={projectId} workspace={workspace} onChange={reloadWorkspace} />
            <PitchDeckHandoffReviewSection projectId={projectId} workspace={workspace} onChange={reloadWorkspace} />
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <IdeasSection
            title="Rejected ideas"
            fields={[
              ["title", "Title"],
              ["idea_text", "Idea text"],
              ["reason_for_rejection", "Reason for rejection"]
            ]}
            items={workspace.rejectedIdeas}
            onSubmit={(input) =>
              api
                .createRejectedIdea(projectId, {
                  title: input.title,
                  idea_text: input.idea_text,
                  reason_for_rejection: input.reason_for_rejection
                })
                .then(reloadWorkspace)
            }
          />
          <IdeasSection
            title="Shortlisted ideas"
            fields={[
              ["title", "Title"],
              ["idea_text", "Idea text"],
              ["why_shortlisted", "Why it was shortlisted"]
            ]}
            items={workspace.shortlistedIdeas}
            onSubmit={(input) =>
              api
                .createShortlistedIdea(projectId, {
                  title: input.title,
                  idea_text: input.idea_text,
                  why_shortlisted: input.why_shortlisted
                })
                .then(reloadWorkspace)
            }
          />
          <RoutesSection projectId={projectId} workspace={workspace} onChange={reloadWorkspace} />
        </div>
        </details>
      </section>
    </main>
  );
}

function ProjectChatCommandCenter({
  project,
  projectId,
  messages,
  sources,
  outputs,
  onMessagesChange,
  onSourcesChange,
  onSourcesReload,
  onWorkspaceReload
}: {
  project: Project;
  projectId: string;
  messages: ProjectMessage[];
  sources: ProjectSource[];
  outputs: ProjectWorkspaceData;
  onMessagesChange: (messages: ProjectMessage[]) => void;
  onSourcesChange: (updater: (current: ProjectSource[]) => ProjectSource[]) => void;
  onSourcesReload: () => Promise<void>;
  onWorkspaceReload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const recentOutputs = [
    ...outputs.campaignBlueprints.map((item) => ({ label: "Blueprint", title: item.blueprint_title })),
    ...outputs.pitchDeckHandoffs.map((item) => ({ label: "Deck handoff", title: item.handoff_type })),
    ...outputs.pitchDeckHandoffReviews.map((item) => ({ label: "Deck review", title: item.client_readiness_status })),
    ...outputs.routes.map((item) => ({ label: "Route", title: item.route_title || item.route_name || "Developed route" })),
    ...(outputs.finalTruth ? [{ label: "Campaign truth", title: outputs.finalTruth.final_route_title || "Final campaign truth" }] : [])
  ].slice(0, 5);

  const send = async (nextDraft = draft) => {
    const content = nextDraft.trim();
    if (!content || sending) return;
    setSending(true);
    setChatError(null);
    setDraft("");
    try {
      const response = await api.sendMessage(projectId, content);
      onMessagesChange([...messages, ...response.messages]);
      await Promise.all([onSourcesReload(), onWorkspaceReload()]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not send message");
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setChatError(null);
    try {
      for (const file of files) {
        const { source } = await api.uploadProjectSource(projectId, chatFileInput(file), file);
        onSourcesChange((current) => [source, ...current.filter((item) => item.id !== source.id)]);
      }
      await onSourcesReload();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await uploadFiles(event.dataTransfer.files);
  };

  const onFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(event.target.files ?? []);
    event.target.value = "";
  };

  const hasSources = sources.length > 0;
  const hasReadySources = sources.some((s) => s.embedding_status === "embedded");
  const hasIdeas = outputs.routes.length > 0 || outputs.shortlistedIdeas.length > 0;
  const hasBlueprint = outputs.campaignBlueprints.length > 0;
  const hasHandoff = outputs.pitchDeckHandoffs.length > 0;
  const hasFinalTruth = Boolean(outputs.finalTruth);
  const isResearchRunning = sending && messages.at(-1)?.role === "user" && /browse|research|competitor|find what/i.test(messages.at(-1)?.content ?? "");

  const nextActions = useMemo(() => {
    if (!hasSources) {
      return [
        "Browse the client and category before ideation.",
        project.client_name ? `Research ${project.client_name} and competitors.` : "Run standard research on this client.",
        "Find what the category keeps repeating.",
      ];
    }
    if (!hasReadySources) {
      return [
        "Browse the client and category before ideation.",
        "Generate a dossier.",
        `Give me 10 thought starters in ${project.bravery_level || "Sharp"} mode.`,
      ];
    }
    if (!hasIdeas) {
      return [
        "Generate a dossier.",
        `Give me 15 thought starters in ${project.bravery_level || "Wild"} mode.`,
        "Browse competitors before ideation.",
        "Find what competitors are not saying.",
      ];
    }
    if (!hasFinalTruth) {
      return [
        "Give me the wildest version of the best ideas.",
        "Develop idea 1 into a campaign route.",
        "Red-team the strongest route.",
        "What is the sellable version?",
      ];
    }
    if (!hasBlueprint) {
      return [
        "Create the campaign blueprint.",
        "Red-team the final route.",
        "What proof is still needed?",
      ];
    }
    if (!hasHandoff) {
      return [
        "Create the pitch deck handoff.",
        "Review the blueprint for client-readiness.",
      ];
    }
    return [
      "Review the handoff for client-readiness.",
      "Make the deck more Indian.",
      "Make the deck more B2B.",
      "Give me the safer version.",
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSources, hasReadySources, hasIdeas, hasFinalTruth, hasBlueprint, hasHandoff, project.bravery_level, project.client_name]);

  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section
      className={`mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] ${
        dragging ? "outline outline-1 outline-cobalt" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="workspace-section min-h-[620px]">
        <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="stage-pill">Project chat</span>
              <span className="stage-pill">{project.client_name || "Client not set"}</span>
              <span className="stage-pill">{project.research_depth || "Standard"} research</span>
              <span className="stage-pill">{project.bravery_level || "Sharp"} bravery</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">Creative command center</h2>
          </div>
          <label className="btn-secondary cursor-pointer">
            <Paperclip size={16} />
            {uploading ? "Reading files..." : "Add files"}
            <input
              className="sr-only"
              type="file"
              multiple
              accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp"
              onChange={onFileSelect}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {nextActions.map((action) => (
            <button className="btn-secondary min-h-9 px-3 py-1 text-xs" type="button" key={action} onClick={() => send(action)}>
              <Sparkles size={14} />
              {action}
            </button>
          ))}
        </div>

        <div ref={threadRef} className="min-h-[320px] space-y-3 overflow-auto border border-line bg-ink/30 p-3">
          {messages.length ? (
            messages.map((message) => <ChatMessageBubble message={message} key={message.id} />)
          ) : (
            <div className="message assistant">
              <p className="message-role">assistant</p>
              <p className="whitespace-pre-wrap leading-6">
                I’m ready. Add files or ask me to browse live web before ideation.
              </p>
            </div>
          )}
        </div>

        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <textarea
            className="field min-h-24 resize-y"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tell Momentum Lab what to do next..."
          />
          <button className="btn-primary self-end" disabled={sending || !draft.trim()}>
            <Send size={17} />
            {sending ? "Working..." : "Send"}
          </button>
        </form>
        {chatError ? <p className="text-sm text-red-300">{chatError}</p> : null}
        {isResearchRunning ? (
          <p className="text-sm text-cobalt">Browsing the web... this may take 15–30 seconds.</p>
        ) : null}
        {uploading || dragging ? (
          <p className="text-sm text-slate-400">
            {dragging ? "Drop files to add them to this project." : "Uploading, reading, and indexing files..."}
          </p>
        ) : null}
      </div>

      <aside className="space-y-5">
        <section className="workspace-section">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Project sources</h2>
            <FileUp size={18} className="text-slate-500" />
          </div>
          <div className="space-y-3">
            {sources.length ? (
              sources.slice(0, 8).map((source) => (
                <article className="workspace-item p-3" key={source.id}>
                  <h3 className="break-words text-sm font-semibold text-white">{source.file_name || source.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="stage-pill">{plainSourceStatus(source)}</span>
                    <span className="stage-pill">{source.source_role.replaceAll("_", " ")}</span>
                  </div>
                  {source.processing_error || source.embedding_error ? (
                    <p className="mt-2 text-xs text-red-300">{source.processing_error || source.embedding_error}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-400">No project sources yet.</p>
            )}
          </div>
        </section>

        <section className="workspace-section">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Recent outputs</h2>
            <Globe2 size={18} className="text-slate-500" />
          </div>
          <div className="space-y-3">
            {recentOutputs.length ? (
              recentOutputs.map((item, index) => (
                <div className="workspace-item p-3" key={`${item.label}-${index}`}>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-100">{item.title}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Dossiers, ideas, routes, and handoffs will appear here.</p>
            )}
          </div>
        </section>
      </aside>
    </section>
  );
}

function ChatMessageBubble({ message }: { message: ProjectMessage }) {
  const roleLabel = message.role === "assistant" ? "Momentum Lab" : "Adwait";
  const sources = extractWebSources(message.content);
  const bodyText = sources.length ? stripSourcesBlock(message.content) : message.content;

  return (
    <article className={message.role === "user" ? "message user" : "message assistant"}>
      <p className="message-role">
        {roleLabel}
        {message.message_type && message.message_type !== "normal_chat" ? (
          <span className="ml-2 text-xs text-slate-500">{messageTypeLabel(message.message_type)}</span>
        ) : null}
      </p>
      <div className="whitespace-pre-wrap leading-6">{renderMessageContent(bodyText)}</div>
      {sources.length ? (
        <div className="mt-3 space-y-1 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Web sources</p>
          {sources.map((source, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-xs text-slate-500">{index + 1}.</span>
              <a
                className="break-all text-xs text-cobalt underline hover:text-blue-300"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title || source.url}
              </a>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function messageTypeLabel(type: string) {
  const labels: Record<string, string> = {
    research_dossier: "[LIVE WEB SOURCE]",
    thought_starters: "[IDEAS]",
    shortlist: "[SHORTLIST]",
    route_development: "[ROUTE]",
    final_route: "[FINAL ROUTE]",
    critique: "[CRITIQUE]",
    export: "[HANDOFF]"
  };
  return labels[type] ?? "";
}

function renderMessageContent(content: string) {
  // Render label tags with subtle highlight
  const labelPattern = /(\[(?:LIVE WEB SOURCE|PROJECT SOURCE|GLOBAL SOURCE|ASSUMPTION|CLIENT INPUT NEEDED|CLAIM REQUIRES SOURCE|DATA POINT TO BE CONFIRMED|UNVERIFIED|WEB RESEARCH FAILED|LIMITED RESEARCH[^\]]*|NOT READY FOR CLIENT|VOICE ASSUMPTION|FEASIBILITY TO BE CHECKED)[^\]]*\])/g;
  const parts = content.split(labelPattern);
  return parts.map((part, index) =>
    labelPattern.test(part) ? (
      <span key={index} className="rounded bg-slate-700/60 px-1 py-0.5 text-xs font-mono text-slate-300">
        {part}
      </span>
    ) : /^https?:\/\//.test(part) ? (
      <a className="text-cobalt underline" href={part} target="_blank" rel="noreferrer" key={index}>
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

function extractWebSources(content: string): Array<{ title: string; url: string }> {
  const sourcesMatch = content.match(/\nSources:\n([\s\S]+)$/);
  if (!sourcesMatch) return [];
  return sourcesMatch[1]
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const urlMatch = line.match(/(https?:\/\/\S+)/);
      const url = urlMatch ? urlMatch[1] : "";
      const title = line.replace(/ - https?:\/\/\S+$/, "").replace(/https?:\/\/\S+/, "").trim() || url;
      return { title, url };
    })
    .filter((s) => s.url);
}

function stripSourcesBlock(content: string) {
  return content.replace(/\nSources:\n[\s\S]+$/, "").trimEnd();
}


function chatFileInput(file: File): SourceInput {
  return {
    title: titleFromProjectFile(file.name),
    source_role: "context",
    source_type: projectSourceTypeFromFile(file),
    source_status: "active",
    tags: [],
    description: "",
    source_url: "",
    content_text: ""
  };
}

function titleFromProjectFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || fileName;
}

function projectSourceTypeFromFile(file: File): SourceInput["source_type"] {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || file.type === "text/plain") return "text";
  if (extension === "md" || file.type === "text/markdown") return "markdown";
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (extension === "docx" || file.type.includes("wordprocessingml")) return "docx";
  if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "") || file.type.startsWith("image/")) return "image";
  return "other";
}

function plainSourceStatus(source: ProjectSource) {
  if (source.processing_status === "failed" || source.embedding_status === "failed") return "Needs attention";
  if (source.embedding_status === "embedded") return "Ready";
  if (source.processing_status === "processed") return "Indexing";
  if (source.processing_status === "processing") return "Reading file";
  if (source.processing_status === "queued") return "Reading file";
  return "Uploading";
}

function IdeaExplorer({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [dossierId, setDossierId] = useState("");
  const [dossiers, setDossiers] = useState<ProjectDossier[]>([]);
  const [bravery, setBravery] = useState<BraveryLevel>("Sharp");
  const [scope, setScope] = useState<"project_only" | "global_only" | "project_plus_global">("project_only");
  const [mode, setMode] = useState<"keyword" | "semantic">("semantic");
  const [roles, setRoles] = useState<string[]>([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState<string[]>(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [count, setCount] = useState(8);
  const [instruction, setInstruction] = useState("");
  const [ideas, setIdeas] = useState<ProjectIdeaCard[]>([]);
  const [status, setStatus] = useState("all");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadIdeas = async () => {
    const [{ ideas }, { dossiers }] = await Promise.all([
      api.listProjectIdeaCards(projectId),
      api.listProjectDossiers(projectId)
    ]);
    setIdeas(ideas);
    setDossiers(dossiers);
  };

  useEffect(() => {
    loadIdeas().catch(() => undefined);
  }, [projectId]);

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    try {
      const response = await api.generateProjectIdeaCards(projectId, {
        query,
        dossier_id: dossierId || undefined,
        bravery_level: bravery,
        retrieval_scope: scope,
        retrieval_mode: mode,
        source_roles: roles as ProjectIdeaCard["selected_roles"],
        source_types: types as ProjectIdeaCard["selected_source_types"],
        idea_count: count,
        user_instruction: instruction || undefined
      });
      setIdeas((current) => [...response.ideas, ...current]);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate ideas");
    } finally {
      setGenerating(false);
    }
  };

  const updateIdea = (idea: ProjectIdeaCard) => {
    setIdeas((current) => current.map((item) => (item.id === idea.id ? idea : item)));
  };

  const visibleIdeas = ideas.filter((idea) => status === "all" || idea.status === status);

  return (
    <section className="workspace-section">
      <SectionTitle title="Idea Explorer" />
      <form className="space-y-3" onSubmit={generate}>
        <textarea className="field min-h-20 resize-y" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What should the first thought-starters explore?" required />
        <div className="grid gap-3 md:grid-cols-2">
          <select className="field" value={dossierId} onChange={(event) => setDossierId(event.target.value)}>
            <option value="">No dossier selected</option>
            {dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.title}</option>)}
          </select>
          <FilterSelect value={bravery} options={BRAVERY_LEVELS} onChange={(value) => setBravery(value as BraveryLevel)} placeholder="Bravery" />
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={(value) => setScope(value as typeof scope)} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="field-label">Number of ideas</span>
            <input className="field" type="number" min={3} max={15} value={count} onChange={(event) => setCount(Number(event.target.value))} />
          </label>
          <Field label="Optional instruction" value={instruction} onChange={setInstruction} />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, setRoles)} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        <button className="btn-primary" disabled={generating}>
          <Plus size={17} />
          {generating ? "Generating..." : "Generate ideas"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4">
        <FilterSelect value={status} options={["all", "generated", "rejected", "shortlisted", "developed", "archived"]} onChange={setStatus} placeholder="Status" />
      </div>
      <div className="mt-4 space-y-3">
        {visibleIdeas.map((idea) => (
          <article className="workspace-item" key={idea.id}>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="stage-pill">{idea.status}</span>
              <span className="stage-pill">{idea.bravery_level}</span>
              <span className="stage-pill">{idea.retrieval_mode}</span>
            </div>
            <h3 className="mt-2 font-semibold text-white">{idea.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{idea.one_line_idea}</p>
            <IdeaField label="Core collision" value={idea.core_collision} />
            <IdeaField label="Audience tension" value={idea.audience_tension} />
            <IdeaField label="Product truth" value={idea.product_truth} />
            <IdeaField label="Execution format" value={idea.execution_format} />
            <IdeaField label="Why it may work" value={idea.why_it_may_work} />
            <IdeaField label="Less generic because" value={idea.non_generic_reason} />
            <IdeaField label="Risk/watchout" value={idea.risk_watchout} />
            <IdeaField label="Grounding" value={idea.source_grounding_note} />
            {idea.assumptions.length ? <IdeaField label="Assumptions" value={idea.assumptions.join("; ")} /> : null}
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <input className="field" value={reasons[idea.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [idea.id]: event.target.value }))} placeholder="Reason" />
              <button className="btn-secondary" type="button" onClick={async () => updateIdea((await api.rejectProjectIdeaCard(projectId, idea.id, reasons[idea.id] ?? "")).idea)}>
                Reject
              </button>
              <button className="btn-secondary" type="button" onClick={async () => updateIdea((await api.shortlistProjectIdeaCard(projectId, idea.id, reasons[idea.id] ?? "")).idea)}>
                Shortlist
              </button>
            </div>
            {idea.rejection_reason ? <p className="mt-2 text-xs text-red-300">Rejected: {idea.rejection_reason}</p> : null}
            {idea.shortlist_reason ? <p className="mt-2 text-xs text-emerald-300">Shortlisted: {idea.shortlist_reason}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function IdeaField({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 text-sm leading-6 text-slate-300">
      <span className="text-slate-500">{label}: </span>
      {value}
    </p>
  );
}

function IdeaEvaluation({ projectId }: { projectId: string }) {
  const [ideas, setIdeas] = useState<ProjectIdeaCard[]>([]);
  const [evaluations, setEvaluations] = useState<ProjectIdeaEvaluation[]>([]);
  const [dossiers, setDossiers] = useState<ProjectDossier[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);
  const [dossierId, setDossierId] = useState("");
  const [query, setQuery] = useState("Evaluate these ideas against the brief and source context.");
  const [evaluationMode, setEvaluationMode] = useState("Strategic review");
  const [scope, setScope] = useState<"project_only" | "global_only" | "project_plus_global">("project_only");
  const [mode, setMode] = useState<"keyword" | "semantic">("semantic");
  const [roles, setRoles] = useState<string[]>([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState<string[]>(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = async () => {
    const [{ ideas }, { evaluations }, { dossiers }] = await Promise.all([
      api.listProjectIdeaCards(projectId),
      api.listProjectIdeaEvaluations(projectId),
      api.listProjectDossiers(projectId)
    ]);
    setIdeas(ideas);
    setEvaluations(evaluations);
    setDossiers(dossiers);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [projectId]);

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setEvaluating(true);
    try {
      const response = await api.generateProjectIdeaEvaluations(projectId, {
        query,
        idea_card_ids: selectedIdeas,
        dossier_id: dossierId || undefined,
        evaluation_mode: evaluationMode as ProjectIdeaEvaluation["evaluation_mode"],
        retrieval_scope: scope,
        retrieval_mode: mode,
        source_roles: roles as ProjectIdeaEvaluation["selected_roles"],
        source_types: types as ProjectIdeaEvaluation["selected_source_types"]
      });
      setEvaluations((current) => [...response.evaluations, ...current]);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not evaluate ideas");
    } finally {
      setEvaluating(false);
    }
  };

  const evaluationsByIdea = evaluations.reduce<Record<string, ProjectIdeaEvaluation[]>>(
    (groups, evaluation) => ({
      ...groups,
      [evaluation.idea_card_id]: [...(groups[evaluation.idea_card_id] ?? []), evaluation]
    }),
    {}
  );

  return (
    <section className="workspace-section">
      <SectionTitle title="Idea Evaluation" />
      <form className="space-y-3" onSubmit={generate}>
        <textarea className="field min-h-16 resize-y" value={query} onChange={(event) => setQuery(event.target.value)} required />
        <div className="grid gap-3 md:grid-cols-2">
          <select className="field" value={dossierId} onChange={(event) => setDossierId(event.target.value)}>
            <option value="">No dossier selected</option>
            {dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.title}</option>)}
          </select>
          <FilterSelect value={evaluationMode} options={EVALUATION_MODES} onChange={setEvaluationMode} placeholder="Evaluation mode" />
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={(value) => setScope(value as typeof scope)} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, setRoles)} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        <div>
          <p className="field-label">Idea cards</p>
          <div className="max-h-64 space-y-2 overflow-auto border border-line p-2">
            {ideas.map((idea) => (
              <label className="flex items-start gap-2 text-sm text-slate-300" key={idea.id}>
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={selectedIdeas.includes(idea.id)}
                  onChange={() => toggle(idea.id, selectedIdeas, setSelectedIdeas)}
                />
                <span>
                  <span className="block text-white">{idea.title}</span>
                  <span className="text-xs text-slate-500">{idea.status} · {idea.bravery_level}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary" disabled={evaluating || !selectedIdeas.length}>
          <Search size={17} />
          {evaluating ? "Evaluating..." : "Generate evaluation"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {ideas.filter((idea) => evaluationsByIdea[idea.id]?.length).map((idea) => (
          <article className="workspace-item" key={idea.id}>
            <h3 className="font-semibold text-white">{idea.title}</h3>
            <div className="mt-3 space-y-3">
              {evaluationsByIdea[idea.id].map((evaluation) => (
                <div className="border border-line p-3" key={evaluation.id}>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="stage-pill">{evaluation.evaluation_mode}</span>
                    <span className="stage-pill">Sharpness {evaluation.overall_sharpness_score}/10</span>
                    <span className="stage-pill">Generic risk {evaluation.genericness_risk_score}/10</span>
                    <span className="stage-pill">{evaluation.development_readiness}</span>
                    <span className="stage-pill">{evaluation.recommended_action}</span>
                  </div>
                  <IdeaField label="Verdict" value={evaluation.overall_verdict} />
                  <IdeaField label="Strongest" value={evaluation.strongest_aspect} />
                  <IdeaField label="Weakest" value={evaluation.weakest_aspect} />
                  <IdeaField label="Source grounding" value={evaluation.source_grounding_assessment} />
                  {evaluation.unsupported_claims.length ? <IdeaField label="Unsupported claims" value={evaluation.unsupported_claims.join("; ")} /> : null}
                  {evaluation.feasibility_risks.length ? <IdeaField label="Feasibility risks" value={evaluation.feasibility_risks.join("; ")} /> : null}
                  {evaluation.sharpness_suggestions.length ? <IdeaField label="Sharper directions" value={evaluation.sharpness_suggestions.join("; ")} /> : null}
                  <div className="mt-2 grid gap-1 text-xs text-slate-400 md:grid-cols-2">
                    {Object.entries(evaluation.scores_json).map(([key, value]) => (
                      <span key={key}>{key.replaceAll("_", " ")}: {value}/5</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CreativeIntelligenceDossier({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"project_only" | "global_only" | "project_plus_global">("project_only");
  const [mode, setMode] = useState<"keyword" | "semantic">("semantic");
  const [roles, setRoles] = useState<string[]>([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState<string[]>(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [dossiers, setDossiers] = useState<ProjectDossier[]>([]);
  const [active, setActive] = useState<ProjectDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.listProjectDossiers(projectId).then(({ dossiers }) => {
      setDossiers(dossiers);
      setActive(dossiers[0] ?? null);
    }).catch(() => undefined);
  }, [projectId]);

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    try {
      const response = await api.generateProjectDossier(projectId, {
        query,
        retrieval_scope: scope,
        retrieval_mode: mode,
        source_roles: roles as ProjectDossier["selected_roles"],
        source_types: types as ProjectDossier["selected_source_types"]
      });
      setActive(response.dossier);
      setDossiers((current) => [response.dossier, ...current]);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate dossier");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="workspace-section">
      <SectionTitle title="Creative Intelligence Dossier" />
      <form className="space-y-3" onSubmit={generate}>
        <textarea className="field min-h-20 resize-y" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What should the dossier prepare for?" required />
        <div className="grid gap-3 md:grid-cols-2">
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={(value) => setScope(value as typeof scope)} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, setRoles)} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        <button className="btn-primary" disabled={generating}>
          <Search size={17} />
          {generating ? "Generating..." : "Generate dossier"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {dossiers.length ? (
        <select className="field mt-4" value={active?.id ?? ""} onChange={(event) => setActive(dossiers.find((item) => item.id === event.target.value) ?? null)}>
          {dossiers.map((dossier) => (
            <option key={dossier.id} value={dossier.id}>
              {dossier.title} · {new Date(dossier.created_at).toLocaleString()}
            </option>
          ))}
        </select>
      ) : null}
      {active ? <DossierView dossier={active} /> : null}
    </section>
  );
}

function DossierView({ dossier }: { dossier: ProjectDossier }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="stage-pill">{dossier.retrieval_scope.replaceAll("_", " ")}</span>
        <span className="stage-pill">{dossier.retrieval_mode}</span>
        <span className="stage-pill">{dossier.model_name}</span>
      </div>
      {dossier.dossier_content.sections.map((section) => (
        <div className="workspace-item" key={section.key}>
          <h3 className="font-semibold text-white">{section.title}</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
            {section.content.map((item, index) => (
              <li key={`${section.key}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className="workspace-item">
        <h3 className="font-semibold text-white">Source grounding summary</h3>
        <p className="mt-2 text-sm text-slate-400">
          {dossier.grounding_metadata.context_pack_total_chunks} chunks · {dossier.grounding_metadata.mandatory_rule_chunks} mandatory · {dossier.grounding_metadata.source_titles.length} sources
        </p>
      </div>
      {dossier.assumptions.length ? (
        <div className="workspace-item">
          <h3 className="font-semibold text-white">Assumptions</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">{dossier.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      {dossier.missing_context.length ? (
        <div className="workspace-item">
          <h3 className="font-semibold text-white">Missing context</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">{dossier.missing_context.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

function ContextPackPreview({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"project_only" | "global_only" | "project_plus_global">("project_only");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [roles, setRoles] = useState<string[]>([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState<string[]>(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [pack, setPack] = useState<ContextPack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleValue = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await api.generateProjectContextPack(projectId, {
        query,
        retrieval_scope: scope,
        retrieval_mode: mode,
        source_roles: roles as ContextPack["assumptions"]["included_source_roles"],
        source_types: types as ContextPack["assumptions"]["included_source_types"]
      });
      setPack(response.contextPack);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate context pack");
      setPack(null);
    }
  };

  return (
    <section className="workspace-section">
      <SectionTitle title="Context Pack Preview" />
      <form className="space-y-3" onSubmit={generate}>
        <textarea className="field min-h-20 resize-y" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe the task or retrieval intent" required />
        <div className="grid gap-3 md:grid-cols-2">
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={(value) => setScope(value as typeof scope)} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggleValue(value, roles, setRoles)} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggleValue(value, types, setTypes)} />
        <button className="btn-primary">
          <Search size={17} />
          Generate preview
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {pack ? <ContextPackView pack={pack} /> : null}
    </section>
  );
}

function CheckboxGroup({
  title,
  values,
  selected,
  onToggle
}: {
  title: string;
  values: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="field-label">{title}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <label className="flex items-center gap-2 border border-line px-2 py-1 text-xs text-slate-300" key={value}>
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />
            {value.replaceAll("_", " ")}
          </label>
        ))}
      </div>
    </div>
  );
}

function ContextPackView({ pack }: { pack: ContextPack }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="stage-pill">{pack.retrieval_scope.replaceAll("_", " ")}</span>
        <span className="stage-pill">{pack.retrieval_mode}</span>
        <span className="stage-pill">{pack.total_chunks} chunks</span>
        <span className="stage-pill">{pack.total_characters} chars</span>
        <span className="stage-pill">{pack.mandatory_rules_found ? "Mandatory rules found" : "No mandatory rules"}</span>
      </div>
      {pack.sections.map((section) => (
        <div className="workspace-item" key={section.key}>
          <h3 className="font-semibold text-white">{section.title}</h3>
          {!section.chunks.length ? <p className="mt-2 text-sm text-slate-500">No chunks included.</p> : null}
          <div className="mt-3 space-y-3">
            {section.chunks.map((chunk) => (
              <article className="border border-line p-3" key={chunk.chunk_id}>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="stage-pill">{chunk.source_scope}</span>
                  <span className="stage-pill">{chunk.source_role.replaceAll("_", " ")}</span>
                  <span className="stage-pill">{chunk.source_type}</span>
                  <span>chunk {chunk.chunk_index + 1}</span>
                  {typeof chunk.similarity === "number" ? <span>{chunk.similarity.toFixed(3)}</span> : null}
                </div>
                <h4 className="mt-2 text-sm font-medium text-white">{chunk.source_title}</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{chunk.snippet}</p>
              </article>
            ))}
          </div>
        </div>
      ))}
      {pack.missing_or_unavailable_context.length ? (
        <div className="workspace-item">
          <h3 className="font-semibold text-white">Missing or unavailable context</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {pack.missing_or_unavailable_context.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProjectSourceSearch({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"project" | "global" | "combined">("combined");
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<SourceSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await api.searchProjectSources(projectId, {
        q: query,
        scope,
        mode,
        source_role: role ? (role as SourceInput["source_role"]) : undefined,
        source_type: type ? (type as SourceInput["source_type"]) : undefined,
        limit
      });
      setResults(response.results);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Search failed");
    }
  };

  return (
    <section className="workspace-section">
      <SectionTitle title="Source search" />
      <form className="space-y-3" onSubmit={runSearch}>
        <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search extracted source text" required />
        <div className="grid gap-3 md:grid-cols-5">
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
          <FilterSelect value={scope} options={["project", "combined", "global"]} onChange={(value) => setScope(value as typeof scope)} placeholder="Scope" />
          <FilterSelect value={role} options={SOURCE_ROLE_VALUES} onChange={setRole} placeholder="Any role" />
          <FilterSelect value={type} options={SOURCE_TYPES} onChange={setType} placeholder="Any type" />
          <input className="field" type="number" min={1} max={20} value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
        </div>
        <button className="btn-primary">
          <Search size={17} />
          Search
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <SearchResults results={results} />
    </section>
  );
}

function ProjectSourcesSection({
  projectId,
  sources,
  onArchived,
  onChange
}: {
  projectId: string;
  sources: ProjectSource[];
  onArchived: (sourceId: string) => void;
  onChange: () => Promise<void>;
}) {
  return (
    <SourceManager
      scope="project"
      title="Upload project files"
      listTitle="Project source list"
      emptyText="No project sources have been added yet."
      sources={sources}
      onReload={onChange}
      uploadFile={(input, file) => api.uploadProjectSource(projectId, input, file)}
      createSource={(input) => api.createProjectSource(projectId, input)}
      updateSource={(sourceId, input) => api.updateProjectSource(projectId, sourceId, input)}
      archiveSource={(sourceId) => api.archiveProjectSource(projectId, sourceId)}
      onArchived={onArchived}
      processSource={(sourceId) => api.processProjectSource(projectId, sourceId)}
      embedSource={(sourceId, force) => api.embedProjectSource(projectId, sourceId, force)}
      getContent={(sourceId) => api.getProjectSourceContent(projectId, sourceId)}
      getDownloadUrl={(sourceId) => api.getProjectSourceDownloadUrl(projectId, sourceId)}
    />
  );
}

function projectToDraft(project: Project) {
  return {
    project_name: project.project_name ?? "",
    client_name: project.client_name ?? "",
    category: project.category ?? "",
    market: project.market ?? "",
    audience: project.audience ?? "",
    objective: project.objective ?? "",
    known_constraints: project.known_constraints ?? "",
    desired_output_type: project.desired_output_type ?? "",
    brief_notes: project.brief_notes ?? "",
    bravery_level: project.bravery_level ?? "Sharp",
    research_depth: project.research_depth ?? "Standard",
    status: project.status ?? "Draft"
  };
}

function setDraft(
  key: string,
  value: string,
  setter: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  setter((current) => ({ ...current, [key]: value }));
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-white">{title}</h2>;
}

function Field({
  label,
  value,
  onChange,
  textarea,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  required?: boolean;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {textarea ? (
        <textarea
          id={id}
          className="field min-h-24 resize-y"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      ) : (
        <input
          id={id}
          className="field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NotesSection({
  projectId,
  workspace,
  onChange
}: {
  projectId: string;
  workspace: ProjectWorkspaceData;
  onChange: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const addNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    await api.createNote(projectId, content);
    setContent("");
    await onChange();
  };

  return (
    <section className="workspace-section">
      <SectionTitle title="Notes" />
      <form className="space-y-3" onSubmit={addNote}>
        <textarea className="field min-h-24 resize-y" value={content} onChange={(event) => setContent(event.target.value)} />
        <button className="btn-primary">
          <Plus size={17} />
          Add note
        </button>
      </form>
      <div className="space-y-3">
        {workspace.notes.map((note) => (
          <div className="workspace-item" key={note.id}>
            <textarea
              className="field min-h-20 resize-y"
              value={editing[note.id] ?? note.content}
              onChange={(event) => setEditing((current) => ({ ...current, [note.id]: event.target.value }))}
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-secondary" type="button" onClick={() => api.updateNote(projectId, note.id, editing[note.id] ?? note.content).then(onChange)}>
                <Save size={16} />
                Save
              </button>
              <button className="btn-secondary" type="button" onClick={() => api.deleteNote(projectId, note.id).then(onChange)}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IdeasSection({
  title,
  fields,
  items,
  onSubmit
}: {
  title: string;
  fields: Array<[string, string]>;
  items: Array<RejectedIdea | ShortlistedIdea>;
  onSubmit: (input: Record<string, string>) => Promise<void>;
}) {
  const [draft, setDraftState] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(draft);
    setDraftState({});
  };

  return (
    <section className="workspace-section">
      <SectionTitle title={title} />
      <form className="space-y-3" onSubmit={submit}>
        {fields.map(([key, label], index) => (
          <Field
            key={key}
            label={label}
            value={draft[key] ?? ""}
            onChange={(value) => setDraft(key, value, setDraftState)}
            textarea={index > 0}
            required={key === "title"}
          />
        ))}
        <button className="btn-primary">
          <Plus size={17} />
          Add
        </button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div className="workspace-item" key={item.id}>
            <h3 className="font-semibold text-white">{item.title}</h3>
            {ideaDisplayEntries(item)
              .filter(([key, value]) => !["id", "project_id", "title", "created_at"].includes(key) && value)
              .map(([key, value]) => (
                <p className="mt-2 text-sm leading-6 text-slate-300" key={key}>
                  <span className="text-slate-500">{key.replaceAll("_", " ")}: </span>
                  {value}
                </p>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function ideaDisplayEntries(item: RejectedIdea | ShortlistedIdea) {
  const entries: Array<[string, string | null]> = [
    ["idea_text", item.idea_text]
  ];

  if ("reason_for_rejection" in item) {
    entries.push(["reason_for_rejection", item.reason_for_rejection]);
  }

  if ("why_shortlisted" in item) {
    entries.push(["why_shortlisted", item.why_shortlisted]);
  }

  return entries;
}

function RoutesSection({
  projectId,
  workspace,
  onChange
}: {
  projectId: string;
  workspace: ProjectWorkspaceData;
  onChange: () => Promise<void>;
}) {
  const [draft, setDraftState] = useState<Record<string, string>>({});
  const [ideas, setIdeas] = useState<ProjectIdeaCard[]>([]);
  const [evaluations, setEvaluations] = useState<ProjectIdeaEvaluation[]>([]);
  const [dossiers, setDossiers] = useState<ProjectDossier[]>([]);
  const [notes, setNotes] = useState<RouteRevisionNote[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [selectedDossierId, setSelectedDossierId] = useState("");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState("");
  const [routeDepth, setRouteDepth] = useState("Standard route");
  const [query, setQuery] = useState("Develop this idea into a structured campaign route.");
  const [scope, setScope] = useState<"project_only" | "global_only" | "project_plus_global">("project_only");
  const [mode, setMode] = useState<"keyword" | "semantic">("semantic");
  const [roles, setRoles] = useState<string[]>([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState<string[]>(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [routeNotes, setRouteNotes] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields: Array<[string, string]> = [
    ["route_title", "Route title"],
    ["core_thought", "Core thought"],
    ["audience_tension", "Audience tension"],
    ["brand_role", "Brand role"],
    ["execution_notes", "Execution notes"],
    ["risks", "Risks"]
  ];

  const loadRouteInputs = async () => {
    const [{ ideas }, { evaluations }, { dossiers }, { notes }] = await Promise.all([
      api.listProjectIdeaCards(projectId),
      api.listProjectIdeaEvaluations(projectId),
      api.listProjectDossiers(projectId),
      api.listRouteRevisionNotes(projectId)
    ]);
    setIdeas(ideas);
    setEvaluations(evaluations);
    setDossiers(dossiers);
    setNotes(notes);
    setSelectedIdeaId((current) => current || ideas.find((idea) => idea.status === "shortlisted")?.id || ideas[0]?.id || "");
  };

  useEffect(() => {
    loadRouteInputs().catch(() => undefined);
  }, [projectId]);

  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId);
  const ideaEvaluations = evaluations.filter((evaluation) => evaluation.idea_card_id === selectedIdeaId);
  const notesByRoute = notes.reduce<Record<string, RouteRevisionNote[]>>(
    (groups, note) => ({
      ...groups,
      [note.route_id]: [...(groups[note.route_id] ?? []), note]
    }),
    {}
  );

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api.createRoute(projectId, {
      route_title: draft.route_title,
      core_thought: draft.core_thought,
      audience_tension: draft.audience_tension,
      brand_role: draft.brand_role,
      execution_notes: draft.execution_notes,
      risks: draft.risks
    });
    setDraftState({});
    await onChange();
  };

  const generateRoute = async (event: FormEvent) => {
    event.preventDefault();
    setGenerating(true);
    try {
      await api.developRoute(projectId, {
        query,
        idea_card_id: selectedIdeaId,
        dossier_id: selectedDossierId || undefined,
        evaluation_id: selectedEvaluationId || undefined,
        route_depth: routeDepth as DevelopedRoute["route_depth"],
        retrieval_scope: scope,
        retrieval_mode: mode,
        source_roles: roles as ProjectIdeaCard["selected_roles"],
        source_types: types as ProjectIdeaCard["selected_source_types"]
      });
      await onChange();
      await loadRouteInputs();
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not develop route");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="workspace-section">
      <SectionTitle title="Developed routes" />
      <form className="mb-5 space-y-3" onSubmit={generateRoute}>
        <Field label="Route development task" value={query} onChange={setQuery} textarea required />
        <div className="grid gap-3 md:grid-cols-2">
          <select className="field" value={selectedIdeaId} onChange={(event) => setSelectedIdeaId(event.target.value)} required>
            <option value="">Select idea card</option>
            {ideas.map((idea) => (
              <option key={idea.id} value={idea.id}>
                {idea.title} · {idea.status} · {idea.bravery_level}
              </option>
            ))}
          </select>
          <FilterSelect value={routeDepth} options={ROUTE_DEPTHS} onChange={setRouteDepth} placeholder="Route depth" />
          <select className="field" value={selectedDossierId} onChange={(event) => setSelectedDossierId(event.target.value)}>
            <option value="">No dossier selected</option>
            {dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.title}</option>)}
          </select>
          <select className="field" value={selectedEvaluationId} onChange={(event) => setSelectedEvaluationId(event.target.value)}>
            <option value="">Use latest evaluation if available</option>
            {ideaEvaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                {evaluation.evaluation_mode} · sharpness {evaluation.overall_sharpness_score}/10 · {evaluation.recommended_action}
              </option>
            ))}
          </select>
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={(value) => setScope(value as typeof scope)} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
        </div>
        {selectedIdea ? (
          <div className="workspace-item">
            <p className="text-xs text-slate-500">{selectedIdea.status} · {selectedIdea.bravery_level}</p>
            <h3 className="mt-1 font-semibold text-white">{selectedIdea.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{selectedIdea.one_line_idea}</p>
          </div>
        ) : null}
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, setRoles)} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        <button className="btn-primary" disabled={generating || !selectedIdeaId}>
          <Search size={17} />
          {generating ? "Developing..." : "Develop route"}
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      <form className="space-y-3" onSubmit={submit}>
        {fields.map(([key, label], index) => (
          <Field
            key={key}
            label={label}
            value={draft[key] ?? ""}
            onChange={(value) => setDraft(key, value, setDraftState)}
            textarea={index > 0}
            required={key === "route_title"}
          />
        ))}
        <button className="btn-primary">
          <Plus size={17} />
          Add route
        </button>
      </form>
      <div className="space-y-3">
        {workspace.routes.map((route) => (
          <div className="workspace-item" key={route.id}>
            <h3 className="font-semibold text-white">{route.route_title || route.route_name}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
              {route.route_depth ? <span className="stage-pill">{route.route_depth}</span> : null}
              {route.idea_card_id ? <span className="stage-pill">Linked idea</span> : null}
              {route.evaluation_id ? <span className="stage-pill">Linked evaluation</span> : null}
            </div>
            {[
              route.route_summary,
              route.core_campaign_thought || route.core_thought,
              route.audience_tension,
              route.category_pressure,
              route.brand_product_truth,
              route.brand_role,
              route.non_generic_reason,
              route.source_grounding_summary,
              route.feasibility_notes,
              route.execution_notes,
              route.risks || route.risk_notes
            ]
              .filter(Boolean)
              .map((value, index) => (
                <p className="mt-2 text-sm leading-6 text-slate-300" key={`${route.id}-${index}`}>
                  {value}
                </p>
              ))}
            {route.campaign_mechanics?.length ? <IdeaField label="Campaign mechanics" value={route.campaign_mechanics.join("; ")} /> : null}
            {route.sample_touchpoints?.length ? <IdeaField label="Sample touchpoints" value={route.sample_touchpoints.join("; ")} /> : null}
            {route.proof_needed ? <IdeaField label="Proof needed" value={route.proof_needed} /> : null}
            {route.assumptions?.length ? <IdeaField label="Assumptions" value={route.assumptions.join("; ")} /> : null}
            {route.missing_context?.length ? <IdeaField label="Missing context" value={route.missing_context.join("; ")} /> : null}
            {route.next_refinement_questions?.length ? <IdeaField label="Next questions" value={route.next_refinement_questions.join("; ")} /> : null}
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input className="field" value={routeNotes[route.id] ?? ""} onChange={(event) => setRouteNotes((current) => ({ ...current, [route.id]: event.target.value }))} placeholder="Revision note" />
              <button
                className="btn-secondary"
                type="button"
                onClick={async () => {
                  await api.createRouteRevisionNote(projectId, route.id, routeNotes[route.id] ?? "");
                  setRouteNotes((current) => ({ ...current, [route.id]: "" }));
                  await loadRouteInputs();
                }}
              >
                Add note
              </button>
            </div>
            {(notesByRoute[route.id] ?? []).map((note) => (
              <p className="mt-2 text-xs text-slate-500" key={note.id}>
                Revision: {note.note}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalTruthSection({
  projectId,
  workspace,
  initialDraft,
  onChange
}: {
  projectId: string;
  workspace: ProjectWorkspaceData;
  initialDraft: Record<string, string>;
  onChange: () => Promise<void>;
}) {
  const [draft, setDraftState] = useState<Record<string, string>>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const activeRoute = workspace.routes.find((route) => route.id === (draft.developed_route_id || draft.route_id));

  useEffect(() => {
    setDraftState(initialDraft);
  }, [initialDraft]);

  const chooseRoute = (route: DevelopedRoute) => {
    setDraftState((current) => ({
      ...current,
      route_id: route.id,
      developed_route_id: route.id,
      final_route_title: current.final_route_title || route.route_title || route.route_name || "",
      final_campaign_truth: current.final_campaign_truth || route.core_campaign_thought || route.core_thought || "",
      proof_required: current.proof_required || route.proof_needed || "",
      risks_watchouts: current.risks_watchouts || route.risks || route.risk_notes || "",
      assumptions: current.assumptions || (route.assumptions ?? []).join("\n"),
      missing_context: current.missing_context || (route.missing_context ?? []).join("\n")
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.saveFinalTruth(projectId, {
        route_id: draft.developed_route_id || draft.route_id || null,
        developed_route_id: draft.developed_route_id || draft.route_id,
        idea_card_id: activeRoute?.idea_card_id ?? null,
        evaluation_id: activeRoute?.evaluation_id ?? null,
        dossier_id: activeRoute?.dossier_id ?? null,
        final_route_title: draft.final_route_title,
        final_campaign_truth: draft.final_campaign_truth,
        selection_rationale: draft.selection_rationale,
        why_this_route_won: draft.why_this_route_won,
        rejected_or_deprioritised_notes: draft.rejected_or_deprioritised_notes,
        proof_required: draft.proof_required,
        risks_watchouts: draft.risks_watchouts,
        assumptions: draft.assumptions,
        missing_context: draft.missing_context,
        next_action: draft.next_action
      });
      setError(null);
      await onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save final route selection");
    }
  };

  return (
    <section className="workspace-section">
      <SectionTitle title="Final Route and Campaign Truth" />
      {workspace.finalTruth ? (
        <div className="workspace-item mb-4">
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="stage-pill">Active final route</span>
            {workspace.finalTruth.developed_route_id ? <span className="stage-pill">Linked developed route</span> : null}
            {workspace.finalTruth.idea_card_id ? <span className="stage-pill">Linked idea</span> : null}
            {workspace.finalTruth.evaluation_id ? <span className="stage-pill">Linked evaluation</span> : null}
            {workspace.finalTruth.dossier_id ? <span className="stage-pill">Linked dossier</span> : null}
          </div>
          <h3 className="mt-2 font-semibold text-white">{workspace.finalTruth.final_route_title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{workspace.finalTruth.final_campaign_truth}</p>
          {workspace.finalTruth.selection_rationale || workspace.finalTruth.rationale ? (
            <LabeledText label="Selection rationale" value={workspace.finalTruth.selection_rationale ?? workspace.finalTruth.rationale ?? ""} />
          ) : null}
          {workspace.finalTruth.next_action ? <LabeledText label="Next action" value={workspace.finalTruth.next_action} /> : null}
        </div>
      ) : null}
      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        {workspace.routes.map((route) => (
          <button
            key={route.id}
            type="button"
            className={`workspace-item text-left ${activeRoute?.id === route.id ? "border-brand" : ""}`}
            onClick={() => chooseRoute(route)}
          >
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              {route.route_depth ? <span className="stage-pill">{route.route_depth}</span> : null}
              {route.idea_card_id ? <span className="stage-pill">Source idea</span> : null}
              {route.evaluation_id ? <span className="stage-pill">Evaluation</span> : null}
            </div>
            <h3 className="mt-2 font-semibold text-white">{route.route_title || route.route_name}</h3>
            {(route.route_summary || route.core_campaign_thought || route.core_thought) ? (
              <p className="mt-2 text-sm leading-6 text-slate-300">{route.route_summary || route.core_campaign_thought || route.core_thought}</p>
            ) : null}
            {route.proof_needed ? <LabeledText label="Proof gaps" value={route.proof_needed} /> : null}
            {route.risks || route.risk_notes ? <LabeledText label="Risks" value={route.risks || route.risk_notes || ""} /> : null}
            {route.assumptions?.length ? <LabeledText label="Assumptions" value={route.assumptions.join("; ")} /> : null}
          </button>
        ))}
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block">
          <span className="field-label">Selected developed route</span>
          <select className="field" value={draft.developed_route_id || draft.route_id || ""} onChange={(event) => setDraft("developed_route_id", event.target.value, setDraftState)} required>
            <option value="">Select developed route</option>
            {workspace.routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.route_title || route.route_name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Final route title" value={draft.final_route_title ?? ""} onChange={(value) => setDraft("final_route_title", value, setDraftState)} required />
        <Field label="Final campaign truth" value={draft.final_campaign_truth ?? ""} onChange={(value) => setDraft("final_campaign_truth", value, setDraftState)} textarea required />
        <Field label="Selection rationale" value={draft.selection_rationale ?? ""} onChange={(value) => setDraft("selection_rationale", value, setDraftState)} textarea required />
        <Field label="Why this route won" value={draft.why_this_route_won ?? ""} onChange={(value) => setDraft("why_this_route_won", value, setDraftState)} textarea />
        <Field label="Rejected or deprioritised notes" value={draft.rejected_or_deprioritised_notes ?? ""} onChange={(value) => setDraft("rejected_or_deprioritised_notes", value, setDraftState)} textarea />
        <Field label="Proof required" value={draft.proof_required ?? ""} onChange={(value) => setDraft("proof_required", value, setDraftState)} textarea />
        <Field label="Risks and watchouts" value={draft.risks_watchouts ?? ""} onChange={(value) => setDraft("risks_watchouts", value, setDraftState)} textarea />
        <Field label="Assumptions" value={draft.assumptions ?? ""} onChange={(value) => setDraft("assumptions", value, setDraftState)} textarea />
        <Field label="Missing context" value={draft.missing_context ?? ""} onChange={(value) => setDraft("missing_context", value, setDraftState)} textarea />
        <Field label="Next action" value={draft.next_action ?? ""} onChange={(value) => setDraft("next_action", value, setDraftState)} textarea required />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="btn-primary">
          <Save size={17} />
          Save final route selection
        </button>
      </form>
      {workspace.finalSelections?.length ? (
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-semibold text-white">Selection history</h3>
          {workspace.finalSelections.map((selection: FinalCampaignTruth) => (
            <div key={selection.id} className="workspace-item">
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="stage-pill">{selection.status ?? (selection.is_active ? "active" : "superseded")}</span>
                <span>{new Date(selection.selected_at ?? selection.updated_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-white">{selection.final_route_title}</p>
              <p className="mt-1 text-sm text-slate-300">{selection.final_campaign_truth}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LabeledText({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 text-sm leading-6 text-slate-300">
      <span className="text-slate-500">{label}: </span>
      {value}
    </p>
  );
}

function CampaignBlueprintSection({
  projectId,
  workspace,
  onChange
}: {
  projectId: string;
  workspace: ProjectWorkspaceData;
  onChange: () => Promise<void>;
}) {
  const [depth, setDepth] = useState("Standard blueprint");
  const [scope, setScope] = useState("project_plus_global");
  const [mode, setMode] = useState("semantic");
  const [roles, setRoles] = useState([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [instruction, setInstruction] = useState("Expand the active final route into an internal campaign blueprint.");
  const [notes, setNotes] = useState<CampaignBlueprintRevisionNote[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = async () => {
    const response = await api.listCampaignBlueprintRevisionNotes(projectId);
    setNotes(response.notes);
  };

  useEffect(() => {
    loadNotes().catch(() => undefined);
  }, [projectId]);

  const toggle = (value: string, selected: string[], setter: (value: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.generateCampaignBlueprint(projectId, {
        query: instruction,
        final_selection_id: workspace.finalTruth?.id,
        developed_route_id: workspace.finalTruth?.developed_route_id ?? workspace.finalTruth?.route_id ?? undefined,
        blueprint_depth: depth as CampaignBlueprint["blueprint_depth"],
        retrieval_scope: scope as "project_only" | "project_plus_global" | "global_only",
        retrieval_mode: mode as "keyword" | "semantic",
        source_roles: roles as typeof SOURCE_ROLE_VALUES[number][],
        source_types: types as typeof SOURCE_TYPES[number][],
        max_total_chunks: 10,
        user_instruction: instruction
      });
      setError(null);
      await onChange();
      await loadNotes();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate campaign blueprint");
    } finally {
      setBusy(false);
    }
  };

  const notesByBlueprint = notes.reduce<Record<string, CampaignBlueprintRevisionNote[]>>((current, note) => {
    current[note.blueprint_id] = [...(current[note.blueprint_id] ?? []), note];
    return current;
  }, {});

  return (
    <section className="workspace-section">
      <SectionTitle title="Campaign Blueprint" />
      {workspace.finalTruth ? (
        <div className="workspace-item mb-4">
          <span className="stage-pill">Active final selection</span>
          <h3 className="mt-2 font-semibold text-white">{workspace.finalTruth.final_route_title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{workspace.finalTruth.final_campaign_truth}</p>
        </div>
      ) : null}
      <form className="mb-5 space-y-3" onSubmit={generate}>
        <Field label="Blueprint instruction" value={instruction} onChange={setInstruction} textarea required />
        <div className="grid gap-3 md:grid-cols-3">
          <FilterSelect value={depth} options={BLUEPRINT_DEPTHS} onChange={setDepth} placeholder="Blueprint depth" />
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={setScope} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={setMode} placeholder="Mode" />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, (next) => setRoles(next as typeof SOURCE_ROLE_VALUES[number][]))} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="btn-primary" disabled={busy || !workspace.finalTruth}>
          <LayoutDashboard size={17} />
          {busy ? "Generating..." : "Generate campaign blueprint"}
        </button>
      </form>
      <div className="space-y-3">
        {workspace.campaignBlueprints.map((blueprint) => (
          <article key={blueprint.id} className="workspace-item">
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="stage-pill">{blueprint.blueprint_depth}</span>
              <span className="stage-pill">Linked final selection</span>
              <span className="stage-pill">Linked developed route</span>
              {blueprint.evaluation_id ? <span className="stage-pill">Evaluation</span> : null}
              {blueprint.dossier_id ? <span className="stage-pill">Dossier</span> : null}
            </div>
            <h3 className="mt-2 font-semibold text-white">{blueprint.blueprint_title}</h3>
            <LabeledText label="Campaign truth" value={blueprint.selected_campaign_truth} />
            <LabeledText label="Platform" value={blueprint.campaign_platform_statement} />
            <LabeledText label="Primary message" value={String(blueprint.message_hierarchy.primary_message ?? "")} />
            <LabeledText label="Narrative arc" value={blueprint.core_narrative_arc} />
            <LabeledText label="Proof stack required" value={blueprint.proof_stack_required.join("; ")} />
            <LabeledText label="Risks/watchouts" value={blueprint.risks_watchouts.join("; ")} />
            <LabeledText label="Assumptions" value={blueprint.assumptions.join("; ")} />
            <LabeledText label="Missing context" value={blueprint.missing_context.join("; ")} />
            <LabeledText label="Next recommended action" value={blueprint.next_recommended_action} />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {blueprint.execution_pillars.map((pillar, index) => (
                <div key={`${blueprint.id}-pillar-${index}`} className="border border-line p-3">
                  <p className="font-medium text-white">{String(pillar.pillar_name ?? `Pillar ${index + 1}`)}</p>
                  <p className="mt-1 text-sm text-slate-300">{String(pillar.what_it_does ?? "")}</p>
                </div>
              ))}
              {blueprint.touchpoint_system.map((touchpoint, index) => (
                <div key={`${blueprint.id}-touchpoint-${index}`} className="border border-line p-3">
                  <p className="font-medium text-white">{String(touchpoint.touchpoint ?? `Touchpoint ${index + 1}`)}</p>
                  <p className="mt-1 text-sm text-slate-300">{String(touchpoint.role ?? "")}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input className="field" value={noteDrafts[blueprint.id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [blueprint.id]: event.target.value }))} placeholder="Blueprint revision note" />
              <button
                className="btn-secondary"
                type="button"
                onClick={async () => {
                  await api.createCampaignBlueprintRevisionNote(projectId, blueprint.id, noteDrafts[blueprint.id] ?? "");
                  setNoteDrafts((current) => ({ ...current, [blueprint.id]: "" }));
                  await loadNotes();
                }}
              >
                Add note
              </button>
            </div>
            {(notesByBlueprint[blueprint.id] ?? []).map((note) => (
              <p key={note.id} className="mt-2 text-xs text-slate-500">Revision: {note.note}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function PitchDeckHandoffSection({
  projectId,
  workspace,
  onChange
}: {
  projectId: string;
  workspace: ProjectWorkspaceData;
  onChange: () => Promise<void>;
}) {
  const [blueprintId, setBlueprintId] = useState("");
  const [handoffType, setHandoffType] = useState("PPT design team handoff");
  const [deckDepth, setDeckDepth] = useState("Standard deck");
  const [audienceType, setAudienceType] = useState("Client leadership");
  const [scope, setScope] = useState("project_plus_global");
  const [mode, setMode] = useState("semantic");
  const [roles, setRoles] = useState([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [instruction, setInstruction] = useState("Create a copy-pasteable pitch deck build handoff from this campaign blueprint.");
  const [notes, setNotes] = useState<PitchDeckHandoffRevisionNote[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBlueprintId((current) => current || workspace.campaignBlueprints[0]?.id || "");
  }, [workspace.campaignBlueprints]);

  const loadNotes = async () => {
    const response = await api.listPitchDeckHandoffRevisionNotes(projectId);
    setNotes(response.notes);
  };

  useEffect(() => {
    loadNotes().catch(() => undefined);
  }, [projectId]);

  const toggle = (value: string, selected: string[], setter: (value: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const selectedBlueprint = workspace.campaignBlueprints.find((blueprint) => blueprint.id === blueprintId);
  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!blueprintId) return;
    setBusy(true);
    try {
      await api.generatePitchDeckHandoff(projectId, {
        query: instruction,
        campaign_blueprint_id: blueprintId,
        final_selection_id: selectedBlueprint?.final_selection_id,
        developed_route_id: selectedBlueprint?.developed_route_id,
        handoff_type: handoffType as PitchDeckHandoff["handoff_type"],
        deck_depth: deckDepth as PitchDeckHandoff["deck_depth"],
        audience_type: audienceType as PitchDeckHandoff["audience_type"],
        retrieval_scope: scope as "project_only" | "project_plus_global" | "global_only",
        retrieval_mode: mode as "keyword" | "semantic",
        source_roles: roles as typeof SOURCE_ROLE_VALUES[number][],
        source_types: types as typeof SOURCE_TYPES[number][],
        max_total_chunks: 10,
        user_instruction: instruction
      });
      setError(null);
      await onChange();
      await loadNotes();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate pitch deck handoff");
    } finally {
      setBusy(false);
    }
  };

  const notesByHandoff = notes.reduce<Record<string, PitchDeckHandoffRevisionNote[]>>((current, note) => {
    current[note.handoff_id] = [...(current[note.handoff_id] ?? []), note];
    return current;
  }, {});

  return (
    <section className="workspace-section">
      <SectionTitle title="Pitch Deck Handoff" />
      <form className="mb-5 space-y-3" onSubmit={generate}>
        <label className="block">
          <span className="field-label">Campaign blueprint</span>
          <select className="field" value={blueprintId} onChange={(event) => setBlueprintId(event.target.value)} required>
            <option value="">Select campaign blueprint</option>
            {workspace.campaignBlueprints.map((blueprint) => (
              <option key={blueprint.id} value={blueprint.id}>
                {blueprint.blueprint_title} · {blueprint.blueprint_depth}
              </option>
            ))}
          </select>
        </label>
        <Field label="Handoff instruction" value={instruction} onChange={setInstruction} textarea required />
        <div className="grid gap-3 md:grid-cols-3">
          <FilterSelect value={handoffType} options={PITCH_HANDOFF_TYPES} onChange={setHandoffType} placeholder="Handoff type" />
          <FilterSelect value={deckDepth} options={DECK_DEPTHS} onChange={setDeckDepth} placeholder="Deck depth" />
          <FilterSelect value={audienceType} options={DECK_AUDIENCE_TYPES} onChange={setAudienceType} placeholder="Audience" />
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={setScope} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={setMode} placeholder="Mode" />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, (next) => setRoles(next as typeof SOURCE_ROLE_VALUES[number][]))} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="btn-primary" disabled={busy || !blueprintId}>
          <LayoutDashboard size={17} />
          {busy ? "Generating..." : "Generate pitch deck handoff"}
        </button>
      </form>
      <div className="space-y-3">
        {workspace.pitchDeckHandoffs.map((handoff) => (
          <article key={handoff.id} className="workspace-item">
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="stage-pill">{handoff.handoff_type}</span>
              <span className="stage-pill">{handoff.deck_depth}</span>
              <span className="stage-pill">{handoff.audience_type}</span>
              <span className="stage-pill">Linked blueprint</span>
              {handoff.final_selection_id ? <span className="stage-pill">Linked final route</span> : null}
            </div>
            <LabeledText label="Deck purpose" value={String(handoff.deck_purpose.achieve ?? "")} />
            <LabeledText label="Narrative arc" value={Object.values(handoff.narrative_arc).map(String).filter(Boolean).join(" -> ")} />
            <LabeledText label="Proof gaps" value={String((handoff.proof_claim_control.claims_needing_proof as string[] | undefined)?.join("; ") ?? "")} />
            <LabeledText label="Visual/design notes" value={Object.values(handoff.visual_design_notes).map((value) => Array.isArray(value) ? value.join("; ") : String(value)).join(" | ")} />
            <LabeledText label="Open questions" value={handoff.open_questions.join("; ")} />
            <div className="mt-3 space-y-2">
              {handoff.slide_structure.map((slide, index) => (
                <div key={`${handoff.id}-slide-${index}`} className="border border-line p-3">
                  <p className="font-medium text-white">Slide {String(slide.slide_number ?? index + 1)}: {String(slide.slide_title ?? "Untitled slide")}</p>
                  <p className="mt-1 text-sm text-slate-300">{String(slide.slide_job ?? "")}</p>
                  <p className="mt-1 text-xs text-slate-500">{String(slide.readiness_status ?? "")}</p>
                </div>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="field-label">Copy-paste handoff block</span>
              <textarea className="field min-h-64 resize-y font-mono text-xs" readOnly value={handoff.copy_paste_handoff} />
            </label>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input className="field" value={noteDrafts[handoff.id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [handoff.id]: event.target.value }))} placeholder="Handoff revision note" />
              <button
                className="btn-secondary"
                type="button"
                onClick={async () => {
                  await api.createPitchDeckHandoffRevisionNote(projectId, handoff.id, noteDrafts[handoff.id] ?? "");
                  setNoteDrafts((current) => ({ ...current, [handoff.id]: "" }));
                  await loadNotes();
                }}
              >
                Add note
              </button>
            </div>
            {(notesByHandoff[handoff.id] ?? []).map((note) => (
              <p key={note.id} className="mt-2 text-xs text-slate-500">Revision: {note.note}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function PitchDeckHandoffReviewSection({
  projectId,
  workspace,
  onChange
}: {
  projectId: string;
  workspace: ProjectWorkspaceData;
  onChange: () => Promise<void>;
}) {
  const [handoffId, setHandoffId] = useState("");
  const [reviewMode, setReviewMode] = useState("Standard client-readiness review");
  const [scope, setScope] = useState("project_plus_global");
  const [mode, setMode] = useState("semantic");
  const [roles, setRoles] = useState([...SOURCE_ROLE_VALUES]);
  const [types, setTypes] = useState(["text", "markdown", "pdf", "docx", "note", "transcript", "other"]);
  const [instruction, setInstruction] = useState("Review this pitch deck handoff for client readiness before copying it into a separate PPT project.");
  const [notes, setNotes] = useState<PitchDeckHandoffReviewNote[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHandoffId((current) => current || workspace.pitchDeckHandoffs[0]?.id || "");
  }, [workspace.pitchDeckHandoffs]);

  const loadNotes = async () => {
    const response = await api.listPitchDeckHandoffReviewNotes(projectId);
    setNotes(response.notes);
  };

  useEffect(() => {
    loadNotes().catch(() => undefined);
  }, [projectId]);

  const toggle = (value: string, selected: string[], setter: (value: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!handoffId) return;
    setBusy(true);
    try {
      await api.generatePitchDeckHandoffReview(projectId, {
        query: instruction,
        pitch_deck_handoff_id: handoffId,
        review_mode: reviewMode as PitchDeckHandoffReview["review_mode"],
        retrieval_scope: scope as "project_only" | "project_plus_global" | "global_only",
        retrieval_mode: mode as "keyword" | "semantic",
        source_roles: roles as typeof SOURCE_ROLE_VALUES[number][],
        source_types: types as typeof SOURCE_TYPES[number][],
        max_total_chunks: 10,
        user_instruction: instruction
      });
      setError(null);
      await onChange();
      await loadNotes();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate handoff review");
    } finally {
      setBusy(false);
    }
  };

  const notesByReview = notes.reduce<Record<string, PitchDeckHandoffReviewNote[]>>((current, note) => {
    current[note.review_id] = [...(current[note.review_id] ?? []), note];
    return current;
  }, {});

  return (
    <section className="workspace-section">
      <SectionTitle title="Pitch Deck Handoff Review" />
      <form className="mb-5 space-y-3" onSubmit={generate}>
        <label className="block">
          <span className="field-label">Pitch deck handoff</span>
          <select className="field" value={handoffId} onChange={(event) => setHandoffId(event.target.value)} required>
            <option value="">Select pitch deck handoff</option>
            {workspace.pitchDeckHandoffs.map((handoff) => (
              <option key={handoff.id} value={handoff.id}>
                {handoff.handoff_type} · {handoff.deck_depth} · {handoff.audience_type}
              </option>
            ))}
          </select>
        </label>
        <Field label="Review instruction" value={instruction} onChange={setInstruction} textarea required />
        <div className="grid gap-3 md:grid-cols-3">
          <FilterSelect value={reviewMode} options={HANDOFF_REVIEW_MODES} onChange={setReviewMode} placeholder="Review mode" />
          <FilterSelect value={scope} options={["project_only", "project_plus_global", "global_only"]} onChange={setScope} placeholder="Scope" />
          <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={setMode} placeholder="Mode" />
        </div>
        <CheckboxGroup title="Source roles" values={SOURCE_ROLE_VALUES} selected={roles} onToggle={(value) => toggle(value, roles, (next) => setRoles(next as typeof SOURCE_ROLE_VALUES[number][]))} />
        <CheckboxGroup title="Source types" values={SOURCE_TYPES} selected={types} onToggle={(value) => toggle(value, types, setTypes)} />
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="btn-primary" disabled={busy || !handoffId}>
          <Search size={17} />
          {busy ? "Reviewing..." : "Generate handoff review"}
        </button>
      </form>
      <div className="space-y-3">
        {workspace.pitchDeckHandoffReviews.map((review) => {
          const slides = workspace.pitchDeckHandoffSlideReviews.filter((slide) => slide.review_id === review.id);
          return (
            <article key={review.id} className="workspace-item">
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="stage-pill">{review.review_mode}</span>
                <span className="stage-pill">{review.client_readiness_status}</span>
                <span className="stage-pill">Score {review.readiness_score}/100</span>
                <span className="stage-pill">Linked handoff</span>
                {review.campaign_blueprint_id ? <span className="stage-pill">Linked blueprint</span> : null}
              </div>
              <h3 className="mt-2 font-semibold text-white">{review.overall_readiness_verdict}</h3>
              <LabeledText label="Narrative strength" value={review.narrative_strength_assessment} />
              <LabeledText label="Slide logic" value={review.slide_logic_assessment} />
              <LabeledText label="Proof and claim risk" value={review.proof_claim_risk_assessment} />
              <LabeledText label="Unsupported claims" value={review.unsupported_claims.join("; ")} />
              <LabeledText label="Proof gaps" value={review.proof_gaps.join("; ")} />
              <LabeledText label="Internal-only risks" value={review.internal_only_risks.join("; ")} />
              <LabeledText label="Visual asset gaps" value={review.visual_asset_gaps.join("; ")} />
              <LabeledText label="Recommended fixes" value={review.recommended_fixes.join("; ")} />
              <LabeledText label="Do not present yet" value={review.do_not_present_yet_warnings.join("; ")} />
              <label className="mt-3 block">
                <span className="field-label">Copy-paste improvement notes</span>
                <textarea className="field min-h-32 resize-y font-mono text-xs" readOnly value={review.copy_paste_improvement_notes} />
              </label>
              <div className="mt-3 space-y-2">
                {slides.map((slide) => (
                  <div key={slide.id} className="border border-line p-3">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="stage-pill">{slide.final_recommendation}</span>
                      <span>{slide.reviewer_readiness_status}</span>
                    </div>
                    <p className="mt-2 font-medium text-white">Slide {slide.slide_number}: {slide.slide_title}</p>
                    <LabeledText label="Proof status" value={slide.proof_status} />
                    <LabeledText label="Claim risk" value={slide.claim_risk} />
                    <LabeledText label="Visual asset requirement" value={slide.visual_asset_requirement} />
                    <LabeledText label="Client input requirement" value={slide.client_input_requirement} />
                    <LabeledText label="Genericness risk" value={slide.genericness_risk} />
                    <LabeledText label="Recommended fix" value={slide.recommended_fix} />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                <input className="field" value={noteDrafts[review.id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Review note" />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={async () => {
                    await api.createPitchDeckHandoffReviewNote(projectId, review.id, noteDrafts[review.id] ?? "");
                    setNoteDrafts((current) => ({ ...current, [review.id]: "" }));
                    await loadNotes();
                  }}
                >
                  Add note
                </button>
              </div>
              {(notesByReview[review.id] ?? []).map((note) => (
                <p key={note.id} className="mt-2 text-xs text-slate-500">Review note: {note.note}</p>
              ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}
