import { ArrowRight, BookOpen, Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Project } from "@momentum-lab/shared";
import { api } from "../api";

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then(({ projects }) => setProjects(projects))
      .catch((error) => setError(error instanceof Error ? error.message : "Could not load projects"))
      .finally(() => setLoading(false));
  }, []);

  const deleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `Delete "${project.project_name}"? This permanently removes the project workspace, project sources, generated outputs, notes, and uploaded project files.`
    );
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    try {
      await api.deleteProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Momentum Lab is the project base for creative intelligence, research, ideation,
            route development, and final campaign truth work.
          </p>
        </div>
        <Link className="btn-primary inline-flex items-center gap-2" to="/projects/new">
          <Plus size={18} />
          Create new project
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link className="action-tile" to="/knowledge-vault">
          <BookOpen size={20} />
          <span>Global Knowledge Vault</span>
          <ArrowRight size={18} />
        </Link>
        <Link className="action-tile" to="/settings">
          <SettingsIcon size={20} />
          <span>Settings</span>
          <ArrowRight size={18} />
        </Link>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent projects</h2>
          <span className="text-sm text-slate-500">{projects.length} total</span>
        </div>
        {loading ? <p className="mt-5 text-slate-400">Loading projects...</p> : null}
        {error ? <p className="mt-5 text-red-300">{error}</p> : null}
        {!loading && !error && projects.length === 0 ? (
          <div className="mt-5 border border-dashed border-line p-8 text-slate-400">
            No projects yet. Create the first Momentum Lab workspace.
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{project.project_name}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {project.client_name || "No client"} · {project.category || "Uncategorized"}
                  </p>
                </div>
                <span className="stage-pill">{project.current_stage}</span>
              </div>
              <p className="mt-5 text-sm text-slate-500">
                Last updated {new Date(project.updated_at).toLocaleDateString()}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="btn-primary inline-flex items-center gap-2" to={`/projects/${project.id}`}>
                  Open project
                  <ArrowRight size={16} />
                </Link>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={deletingProjectId === project.id}
                  onClick={() => deleteProject(project)}
                >
                  <Trash2 size={16} />
                  {deletingProjectId === project.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
