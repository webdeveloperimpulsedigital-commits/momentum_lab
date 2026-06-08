import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BRAVERY_LEVELS,
  PROJECT_STATUSES,
  RESEARCH_DEPTHS,
  type BraveryLevel,
  type ProjectStatus,
  type ResearchDepth
} from "@momentum-lab/shared";
import { api } from "../api";

const optionalFields = [
  ["client_name", "Client name"],
  ["category", "Category"],
  ["market", "Market or geography"],
  ["audience", "Audience"],
  ["objective", "Objective"],
  ["known_constraints", "Known constraints"],
  ["desired_output_type", "Desired output type"],
  ["brief_notes", "Project brief"]
] as const;

export function CreateProject() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [braveryLevel, setBraveryLevel] = useState<BraveryLevel>("Sharp");
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("Standard");
  const [status, setStatus] = useState<ProjectStatus>("Draft");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { project } = await api.createProject({
        project_name: projectName,
        bravery_level: braveryLevel,
        research_depth: researchDepth,
        status,
        ...fields
      });
      navigate(`/projects/${project.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-3xl font-semibold text-white">Create project</h1>
      <p className="mt-2 text-slate-400">
        Start with the minimum intake. Future build steps will add file uploads and prompt routing.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="field-label" htmlFor="project_name">
            Project name
          </label>
          <input
            id="project_name"
            className="field"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="bravery_level">
            Bravery level
          </label>
          <select
            id="bravery_level"
            className="field"
            value={braveryLevel}
            onChange={(event) => setBraveryLevel(event.target.value as BraveryLevel)}
          >
            {BRAVERY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="research_depth">
              Research depth
            </label>
            <select
              id="research_depth"
              className="field"
              value={researchDepth}
              onChange={(event) => setResearchDepth(event.target.value as ResearchDepth)}
            >
              {RESEARCH_DEPTHS.map((depth) => (
                <option key={depth} value={depth}>
                  {depth}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              className="field"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((projectStatus) => (
                <option key={projectStatus} value={projectStatus}>
                  {projectStatus}
                </option>
              ))}
            </select>
          </div>
        </div>

        {optionalFields.map(([name, label]) => (
          <div key={name}>
            <label className="field-label" htmlFor={name}>
              {label}
            </label>
            <textarea
              id={name}
              className="field min-h-20 resize-y"
              value={fields[name] ?? ""}
              onChange={(event) =>
                setFields((current) => ({ ...current, [name]: event.target.value }))
              }
            />
          </div>
        ))}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create project"}
          </button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/")}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
