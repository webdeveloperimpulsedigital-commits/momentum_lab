import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { User } from "@momentum-lab/shared";
import { api } from "./api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { CreateProject } from "./pages/CreateProject";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { KnowledgeVault } from "./pages/KnowledgeVault";
import { Settings } from "./pages/Settings";
import { LoadingScreen } from "./components/LoadingScreen";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />}
      />
      <Route element={<AppShell user={user} onLogout={() => setUser(null)} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/new" element={<CreateProject />} />
        <Route path="/projects/:projectId" element={<ProjectWorkspace />} />
        <Route path="/knowledge-vault" element={<KnowledgeVault />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}

function AppShell({
  user,
  onLogout
}: {
  user: User | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    onLogout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="border-b border-line bg-panel/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Momentum Lab</p>
            <p className="text-sm text-slate-400">{user.email}</p>
          </div>
          <button className="btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
