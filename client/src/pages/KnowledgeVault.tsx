import {
  ChevronDown,
  Download,
  FileText,
  Link as LinkIcon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload
} from "lucide-react";
import {
  ChangeEvent,
  Dispatch,
  DragEvent,
  FormEvent,
  SetStateAction,
  useEffect,
  useState
} from "react";
import {
  SOURCE_ROLE_VALUES,
  SOURCE_TYPES,
  type GlobalSource,
  type ProjectSource,
  type SourceInput,
  type SourceSearchResult,
  type SourceType
} from "@momentum-lab/shared";
import { api } from "../api";

type ManagedSource = GlobalSource | ProjectSource;
type SourceScope = "global" | "project";
type SourceAction = "files" | "text" | "url";

const simpleSourceDraft: SourceInput = {
  title: "",
  description: "",
  source_role: "context",
  source_type: "text",
  tags: [],
  source_status: "active",
  source_url: "",
  content_text: ""
};

export function KnowledgeVault() {
  const [sources, setSources] = useState<GlobalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { sources } = await api.listGlobalSources();
      setSources(sources);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load global sources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Global Knowledge Vault</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Admin-managed source library for reusable Momentum Lab intelligence.
          </p>
        </div>
      </div>

      {error ? <p className="mt-5 text-sm text-red-300">{error}</p> : null}

      <SourceManager
        scope="global"
        title="Upload sources"
        listTitle="Source list"
        emptyText="No global sources have been added yet."
        sources={sources}
        loading={loading}
        onReload={load}
        uploadFile={(input, file) => api.uploadGlobalSource(input, file)}
        createSource={(input) => api.createGlobalSource(input)}
        updateSource={(sourceId, input) => api.updateGlobalSource(sourceId, input)}
        archiveSource={(sourceId) => api.archiveGlobalSource(sourceId)}
        processSource={(sourceId) => api.processGlobalSource(sourceId)}
        embedSource={(sourceId, force) => api.embedGlobalSource(sourceId, force)}
        getContent={(sourceId) => api.getGlobalSourceContent(sourceId)}
        getDownloadUrl={(sourceId) => api.getGlobalSourceDownloadUrl(sourceId)}
      />

      <GlobalSourceSearch />
    </main>
  );
}

export function SourceManager({
  scope,
  title,
  listTitle,
  emptyText,
  sources,
  loading,
  onReload,
  uploadFile,
  createSource,
  updateSource,
  archiveSource,
  processSource,
  embedSource,
  getContent,
  getDownloadUrl
}: {
  scope: SourceScope;
  title: string;
  listTitle: string;
  emptyText: string;
  sources: ManagedSource[];
  loading?: boolean;
  onReload: () => Promise<void>;
  uploadFile: (input: SourceInput, file: File) => Promise<{ source: ManagedSource }>;
  createSource: (input: SourceInput) => Promise<{ source: ManagedSource }>;
  updateSource: (sourceId: string, input: Partial<SourceInput>) => Promise<{ source: ManagedSource }>;
  archiveSource: (sourceId: string) => Promise<{ source: ManagedSource }>;
  processSource: (sourceId: string) => Promise<{ source: ManagedSource }>;
  embedSource: (sourceId: string, force?: boolean) => Promise<{ source: ManagedSource }>;
  getContent: (sourceId: string) => Promise<{ content: { extracted_text_preview: string } }>;
  getDownloadUrl: (sourceId: string) => Promise<{ signedUrl: string }>;
}) {
  const [dragging, setDragging] = useState(false);
  const [activeAction, setActiveAction] = useState<SourceAction>("files");
  const [textDraft, setTextDraft] = useState<SourceInput>({
    ...simpleSourceDraft,
    source_type: "text"
  });
  const [urlDraft, setUrlDraft] = useState<SourceInput>({
    ...simpleSourceDraft,
    source_type: "url"
  });
  const [editing, setEditing] = useState<Record<string, SourceInput>>({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const failedSources = sources.filter(
    (source) => source.processing_status === "failed" || source.embedding_status === "failed"
  );

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setBusy("Uploading files");
    setMessage(null);
    try {
      for (const file of files) {
        await uploadFile(fileInput(file), file);
      }
      setMessage(`${files.length} file${files.length === 1 ? "" : "s"} uploaded`);
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const onDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    await uploadFiles(event.dataTransfer.files);
  };

  const onFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(event.target.files ?? []);
    event.target.value = "";
  };

  const addText = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("Adding text");
    try {
      await createSource(normalizeSourceInput({
        ...textDraft,
        title: textDraft.title || "Manual text source",
        source_type: "text"
      }));
      setTextDraft({ ...simpleSourceDraft, source_type: "text" });
      setMessage("Manual text source added");
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add text source");
    } finally {
      setBusy(null);
    }
  };

  const addUrl = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("Adding URL");
    try {
      await createSource(normalizeSourceInput({
        ...urlDraft,
        title: urlDraft.title || urlDraft.source_url || "URL source",
        source_type: "url"
      }));
      setUrlDraft({ ...simpleSourceDraft, source_type: "url" });
      setMessage("URL source added");
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add URL source");
    } finally {
      setBusy(null);
    }
  };

  const archiveWithConfirm = async (source: ManagedSource) => {
    const confirmed = window.confirm(
      "Remove this source from future retrieval? Existing metadata will be archived and active searches will stop using it."
    );
    if (!confirmed) return;
    setBusy(`Removing ${source.title}`);
    try {
      await archiveSource(source.id);
      await onReload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="workspace-section mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Drop files here or use a secondary action for pasted text and URLs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={activeAction === "files" ? "btn-primary" : "btn-secondary"}
            type="button"
            onClick={() => setActiveAction("files")}
          >
            <Upload size={16} />
            Upload files
          </button>
          <button
            className={activeAction === "text" ? "btn-primary" : "btn-secondary"}
            type="button"
            onClick={() => setActiveAction("text")}
          >
            <FileText size={16} />
            Add text manually
          </button>
          <button
            className={activeAction === "url" ? "btn-primary" : "btn-secondary"}
            type="button"
            onClick={() => setActiveAction("url")}
          >
            <LinkIcon size={16} />
            Add URL
          </button>
        </div>
      </div>

      {activeAction === "files" ? (
        <label
          className={`block border border-dashed p-8 text-center transition ${
            dragging ? "border-cobalt bg-cobalt/10" : "border-line bg-ink/30"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Upload className="mx-auto text-slate-400" size={30} />
          <span className="mt-3 block text-sm font-semibold text-white">
            Drag and drop files
          </span>
          <span className="mt-1 block text-sm text-slate-400">
            TXT, Markdown, PDF, DOCX, PNG, JPG, JPEG, and WebP up to 25 MB.
          </span>
          <span className="btn-secondary mt-5 inline-flex">
            <Upload size={16} />
            Upload files
          </span>
          <input
            className="sr-only"
            type="file"
            multiple
            accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp"
            onChange={onFileSelect}
          />
        </label>
      ) : null}

      {activeAction === "text" ? (
        <form className="space-y-4 border border-line bg-ink/30 p-4" onSubmit={addText}>
          <Field
            label="Title"
            value={textDraft.title}
            onChange={(value) => setTextDraft((current) => ({ ...current, title: value }))}
            required
          />
          <Field
            label="Text"
            value={textDraft.content_text ?? ""}
            onChange={(value) => setTextDraft((current) => ({ ...current, content_text: value }))}
            textarea
            required
          />
          <button className="btn-primary" disabled={Boolean(busy)}>
            <Plus size={17} />
            Add text source
          </button>
        </form>
      ) : null}

      {activeAction === "url" ? (
        <form className="space-y-4 border border-line bg-ink/30 p-4" onSubmit={addUrl}>
          <Field
            label="URL"
            value={urlDraft.source_url ?? ""}
            onChange={(value) => setUrlDraft((current) => ({ ...current, source_url: value }))}
            required
          />
          <Field
            label="Title"
            value={urlDraft.title}
            onChange={(value) => setUrlDraft((current) => ({ ...current, title: value }))}
          />
          <button className="btn-primary" disabled={Boolean(busy)}>
            <Plus size={17} />
            Add URL source
          </button>
        </form>
      ) : null}

      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      {busy ? <p className="text-sm text-slate-400">{busy}...</p> : null}

      <div className="border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{listTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {sources.length} total - {failedSources.length} failed
            </p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => onReload()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? <p className="mt-4 text-slate-400">Loading sources...</p> : null}
        {!loading && sources.length === 0 ? (
          <div className="mt-4 border border-dashed border-line p-8 text-slate-400">
            {emptyText}
          </div>
        ) : null}

        {failedSources.length ? (
          <div className="mt-4 border border-red-900/60 bg-red-950/20 p-4">
            <h3 className="text-sm font-semibold text-red-200">Failed sources</h3>
            <div className="mt-3 space-y-2">
              {failedSources.map((source) => (
                <p className="text-sm text-red-200" key={source.id}>
                  {source.title}: {source.processing_error || source.embedding_error || "Needs review"}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {sources.map((source) => {
            const current = editing[source.id] ?? sourceToInput(source);
            const detailsOpen = Boolean(openDetails[source.id]);
            return (
              <article className="workspace-item" key={source.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="stage-pill">{scope === "global" ? "Global" : "Project"}</span>
                      <span className="stage-pill">{source.source_type}</span>
                      <span className="stage-pill">{source.source_role.replaceAll("_", " ")}</span>
                    </div>
                    <h3 className="mt-3 break-words font-semibold text-white">
                      {source.file_name || source.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {source.file_name ? source.title : source.source_url || "Manual source"} -{" "}
                      {formatDate(source.uploaded_at || source.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        setOpenDetails((existing) => ({
                          ...existing,
                          [source.id]: !detailsOpen
                        }))
                      }
                    >
                      {detailsOpen ? <ChevronDown size={16} /> : <Pencil size={16} />}
                      {detailsOpen ? "Hide details" : "Edit details"}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => archiveWithConfirm(source)}>
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>

                <SourceStatusLine source={source} />

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => processSource(source.id).then(onReload)}
                  >
                    <FileText size={16} />
                    {source.processing_status === "failed" ? "Retry processing" : "Process"}
                  </button>
                  {source.extracted_text_available ? (
                    <>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={async () => {
                          const { content } = await getContent(source.id);
                          setPreviews((current) => ({
                            ...current,
                            [source.id]: content.extracted_text_preview
                          }));
                        }}
                      >
                        Preview text
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => embedSource(source.id).then(onReload)}
                      >
                        {source.embedding_status === "failed" ? "Retry indexing" : "Index"}
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => embedSource(source.id, true).then(onReload)}
                      >
                        Re-index
                      </button>
                    </>
                  ) : null}
                  {source.storage_path ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={async () => {
                        const { signedUrl } = await getDownloadUrl(source.id);
                        window.open(signedUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Download size={16} />
                      Download
                    </button>
                  ) : null}
                </div>

                {previews[source.id] ? (
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap border border-line bg-ink/50 p-3 text-xs leading-5 text-slate-300">
                    {previews[source.id]}
                  </pre>
                ) : null}

                {detailsOpen ? (
                  <SourceDetailsForm
                    draft={current}
                    setDraft={(next) =>
                      setEditing((existing) => ({
                        ...existing,
                        [source.id]: typeof next === "function" ? next(current) : next
                      }))
                    }
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await updateSource(source.id, normalizeSourceInput(current));
                      await onReload();
                    }}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GlobalSourceSearch() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<SourceSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await api.searchGlobalSources({
        q: query,
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
    <section className="workspace-section mt-8">
      <h2 className="text-lg font-semibold text-white">Search global source text</h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_160px_160px_110px_auto]"
        onSubmit={runSearch}
      >
        <input
          className="field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search extracted text"
          required
        />
        <FilterSelect value={mode} options={["keyword", "semantic"]} onChange={(value) => setMode(value as typeof mode)} placeholder="Mode" />
        <FilterSelect value={role} options={SOURCE_ROLE_VALUES} onChange={setRole} placeholder="Any role" />
        <FilterSelect value={type} options={SOURCE_TYPES} onChange={setType} placeholder="Any type" />
        <input className="field" type="number" min={1} max={20} value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
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

export function SearchResults({ results }: { results: SourceSearchResult[] }) {
  if (!results.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {results.map((result) => (
        <article className="workspace-item" key={result.chunk_id}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="stage-pill">{result.source_scope}</span>
            <span className="stage-pill">{result.source_role.replaceAll("_", " ")}</span>
            <span className="stage-pill">{result.source_type}</span>
            <span>chunk {result.chunk_index + 1}</span>
          </div>
          <h3 className="mt-2 font-semibold text-white">{result.source_title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{result.snippet}</p>
          {typeof result.similarity === "number" ? (
            <p className="mt-2 text-xs text-slate-500">Similarity {result.similarity.toFixed(3)}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function FilterSelect({
  value,
  options,
  onChange,
  placeholder
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

function SourceStatusLine({ source }: { source: ManagedSource }) {
  const processingLabel = processingStatusLabel(source.processing_status);
  const extractionLabel = source.extracted_text_available
    ? `Extracted - ${source.extracted_character_count} chars`
    : source.processing_status === "failed"
      ? "Extraction failed"
      : "Extraction pending";
  const indexingLabel = embeddingStatusLabel(source.embedding_status, source.embedded_chunk_count);

  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
      <span className="stage-pill">{processingLabel}</span>
      <span className="stage-pill">{extractionLabel}</span>
      <span className="stage-pill">{indexingLabel}</span>
      {source.processing_error ? <span className="text-red-300">{source.processing_error}</span> : null}
      {source.embedding_error ? <span className="text-red-300">{source.embedding_error}</span> : null}
      {source.failed_embedding_count ? <span className="text-red-300">{source.failed_embedding_count} failed</span> : null}
      {source.embedding_model ? <span className="stage-pill">{source.embedding_model}</span> : null}
    </div>
  );
}

function SourceDetailsForm({
  draft,
  setDraft,
  onSubmit
}: {
  draft: SourceInput;
  setDraft: Dispatch<SetStateAction<SourceInput>>;
  onSubmit: (event: FormEvent) => void | Promise<void>;
}) {
  return (
    <form className="space-y-4 border border-line bg-ink/30 p-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} required />
        <Field label="Tags" value={(draft.tags ?? []).join(", ")} onChange={(value) => setDraft((current) => ({ ...current, tags: splitTags(value) }))} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Select label="Source role" value={draft.source_role ?? "context"} options={SOURCE_ROLE_VALUES} onChange={(value) => setDraft((current) => ({ ...current, source_role: value as SourceInput["source_role"] }))} />
        <Select label="Source type" value={draft.source_type ?? "text"} options={SOURCE_TYPES} onChange={(value) => setDraft((current) => ({ ...current, source_type: value as SourceInput["source_type"] }))} />
        <Select label="Status" value={draft.source_status ?? "active"} options={["active", "inactive", "archived"]} onChange={(value) => setDraft((current) => ({ ...current, source_status: value as SourceInput["source_status"] }))} />
      </div>
      <Field label="URL" value={draft.source_url ?? ""} onChange={(value) => setDraft((current) => ({ ...current, source_url: value }))} />
      <Field label="Description" value={draft.description ?? ""} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} textarea />
      <Field label="Pasted text content" value={draft.content_text ?? ""} onChange={(value) => setDraft((current) => ({ ...current, content_text: value }))} textarea />
      <button className="btn-primary">
        <Save size={17} />
        Save details
      </button>
    </form>
  );
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
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {textarea ? (
        <textarea className="field min-h-24 resize-y" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      ) : (
        <input className="field" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      )}
    </label>
  );
}

function Select({
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
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function fileInput(file: File): SourceInput {
  return normalizeSourceInput({
    ...simpleSourceDraft,
    title: titleFromFile(file.name),
    source_type: sourceTypeFromFile(file),
    source_role: "context"
  });
}

function titleFromFile(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[-_]+/g, " ").trim() || fileName;
}

function sourceTypeFromFile(file: File): SourceType {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || file.type === "text/plain") return "text";
  if (extension === "md" || file.type === "text/markdown") return "markdown";
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (extension === "docx" || file.type.includes("wordprocessingml")) return "docx";
  if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "") || file.type.startsWith("image/")) {
    return "image";
  }
  return "other";
}

function processingStatusLabel(status: ManagedSource["processing_status"]) {
  if (status === "not_processed") return "Uploaded";
  if (status === "queued") return "Queued";
  if (status === "processing") return "Processing";
  if (status === "processed") return "Processed";
  if (status === "unsupported") return "Needs review";
  return "Failed";
}

function embeddingStatusLabel(status: ManagedSource["embedding_status"], embeddedChunks: number) {
  if (status === "not_embedded") return "Indexing pending";
  if (status === "queued") return "Indexing queued";
  if (status === "embedding") return "Indexing";
  if (status === "embedded") return `Indexed - ${embeddedChunks} chunks`;
  if (status === "skipped") return "Indexing skipped";
  return "Indexing failed";
}

function formatDate(value: string | null) {
  if (!value) return "No upload date";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sourceToInput(source: ManagedSource): SourceInput {
  return {
    title: source.title,
    description: source.description ?? "",
    source_role: source.source_role as SourceInput["source_role"],
    source_type: source.source_type,
    tags: source.tags ?? [],
    source_status: source.source_status as SourceInput["source_status"],
    source_url: source.source_url ?? "",
    content_text: source.content_text ?? ""
  };
}

function normalizeSourceInput(input: SourceInput): SourceInput {
  return {
    ...input,
    tags: input.tags ?? [],
    source_role: input.source_role ?? "context",
    source_type: input.source_type ?? "text",
    source_status: input.source_status ?? "active",
    source_url: input.source_url ?? "",
    content_text: input.content_text ?? ""
  };
}
