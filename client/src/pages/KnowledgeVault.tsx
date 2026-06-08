import { Archive, Download, FileText, Plus, Save, Search, Upload } from "lucide-react";
import { Dispatch, FormEvent, SetStateAction, useEffect, useState } from "react";
import {
  SOURCE_ROLE_VALUES,
  SOURCE_TYPES,
  type GlobalSource,
  type SourceInput,
  type SourceSearchResult
} from "@momentum-lab/shared";
import { api } from "../api";

const initialSource: SourceInput = {
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
  const [draft, setDraft] = useState<SourceInput>(initialSource);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Record<string, SourceInput>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
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
    load();
  }, []);

  const createSource = async (event: FormEvent) => {
    event.preventDefault();
    if (file) {
      await api.uploadGlobalSource(normalizeSourceInput(draft), file);
    } else {
      await api.createGlobalSource(normalizeSourceInput(draft));
    }
    setDraft(initialSource);
    setFile(null);
    await load();
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Global Knowledge Vault</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Admin-managed reusable source metadata for Momentum Lab.
          </p>
        </div>
      </div>

      {error ? <p className="mt-5 text-sm text-red-300">{error}</p> : null}

      <section className="workspace-section mt-8">
        <h2 className="text-lg font-semibold text-white">Add global source</h2>
        <SourceForm
          draft={draft}
          setDraft={setDraft}
          onSubmit={createSource}
          submitLabel={file ? "Upload source" : "Add source"}
          file={file}
          setFile={setFile}
        />
      </section>

      <GlobalSourceSearch />

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Global sources</h2>
          <span className="text-sm text-slate-500">{sources.length} total</span>
        </div>
        {loading ? <p className="mt-4 text-slate-400">Loading sources...</p> : null}
        {!loading && sources.length === 0 ? (
          <div className="mt-4 border border-dashed border-line p-8 text-slate-400">
            No global sources have been added yet.
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {sources.map((source) => {
            const current = editing[source.id] ?? sourceToInput(source);
            return (
              <article className="workspace-section" key={source.id}>
                <SourceForm
                  draft={current}
                  setDraft={(next) =>
                    setEditing((existing) => ({
                      ...existing,
                      [source.id]: typeof next === "function" ? next(current) : next
                    }))
                  }
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await api.updateGlobalSource(source.id, normalizeSourceInput(current));
                    await load();
                  }}
                submitLabel="Save"
                />
                {source.file_name ? (
                  <p className="text-sm text-slate-400">
                    {source.file_name} · {source.mime_type || source.file_type || "unknown type"} ·{" "}
                    {source.file_size ? `${Math.round(source.file_size / 1024)} KB` : "unknown size"}
                  </p>
                ) : null}
                <ProcessingMeta source={source} />
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => api.processGlobalSource(source.id).then(load)}
                  >
                    <FileText size={16} />
                    Process
                  </button>
                  {source.extracted_text_available ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={async () => {
                        const { content } = await api.getGlobalSourceContent(source.id);
                        setPreviews((current) => ({
                          ...current,
                          [source.id]: content.extracted_text_preview
                        }));
                      }}
                    >
                      Preview text
                    </button>
                  ) : null}
                  {source.extracted_text_available ? (
                    <>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => api.embedGlobalSource(source.id).then(load)}
                      >
                        Embed source
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => api.embedGlobalSource(source.id, true).then(load)}
                      >
                        Re-embed source
                      </button>
                    </>
                  ) : null}
                </div>
                {previews[source.id] ? (
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap border border-line bg-ink/50 p-3 text-xs leading-5 text-slate-300">
                    {previews[source.id]}
                  </pre>
                ) : null}
                {source.storage_path ? (
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={async () => {
                      const { signedUrl } = await api.getGlobalSourceDownloadUrl(source.id);
                      window.open(signedUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Download size={16} />
                    Download
                  </button>
                ) : null}
                <button className="btn-secondary" type="button" onClick={() => api.archiveGlobalSource(source.id).then(load)}>
                  <Archive size={16} />
                  Archive
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
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
      <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_160px_160px_110px_auto]" onSubmit={runSearch}>
        <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search extracted text" required />
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

function ProcessingMeta({
  source
}: {
  source: Pick<
    GlobalSource,
    | "processing_status"
    | "processing_error"
    | "extracted_text_available"
    | "extracted_character_count"
    | "embedding_status"
    | "embedded_chunk_count"
    | "failed_embedding_count"
    | "embedding_model"
  >;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
      <span className="stage-pill">{source.processing_status}</span>
      <span className="stage-pill">
        {source.extracted_text_available
          ? `${source.extracted_character_count} chars extracted`
          : "No extracted text"}
      </span>
      {source.processing_error ? <span className="text-red-300">{source.processing_error}</span> : null}
      <span className="stage-pill">{source.embedding_status}</span>
      <span className="stage-pill">{source.embedded_chunk_count} chunks embedded</span>
      {source.failed_embedding_count ? <span className="text-red-300">{source.failed_embedding_count} failed</span> : null}
      {source.embedding_model ? <span className="stage-pill">{source.embedding_model}</span> : null}
    </div>
  );
}

export function SourceForm({
  draft,
  setDraft,
  onSubmit,
  submitLabel,
  file,
  setFile
}: {
  draft: SourceInput;
  setDraft: Dispatch<SetStateAction<SourceInput>>;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  submitLabel: string;
  file?: File | null;
  setFile?: Dispatch<SetStateAction<File | null>>;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
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
      {setFile ? (
        <label className="block">
          <span className="field-label">File</span>
          <input
            className="field"
            type="file"
            accept=".txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="mt-2 text-xs text-slate-500">
              {file.name} · {Math.round(file.size / 1024)} KB
            </p>
          ) : null}
        </label>
      ) : null}
      <button className="btn-primary">
        {submitLabel.includes("Upload") ? <Upload size={17} /> : submitLabel === "Add source" ? <Plus size={17} /> : <Save size={17} />}
        {submitLabel}
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

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sourceToInput(source: GlobalSource): SourceInput {
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
    source_status: input.source_status ?? "active"
  };
}
