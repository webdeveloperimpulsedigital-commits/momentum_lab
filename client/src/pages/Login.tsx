import { FormEvent, useState } from "react";
import type { User } from "@momentum-lab/shared";
import { api } from "../api";

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@momentum.local");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { user } = await api.login(email, password);
      onLogin(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-ink text-slate-100 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex items-center px-6 py-12 lg:px-16">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Internal workspace</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-normal text-white md:text-6xl">
            Momentum Lab
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            A focused creative intelligence foundation for project work, knowledge sources,
            thought starters, shortlists, and final campaign truth development.
          </p>
        </div>
      </section>
      <section className="flex items-center border-t border-line bg-panel px-6 py-12 lg:border-l lg:border-t-0 lg:px-14">
        <form className="w-full max-w-md" onSubmit={handleSubmit}>
          <h2 className="text-2xl font-semibold text-white">Sign in</h2>
          <p className="mt-2 text-sm text-slate-400">
            Use Supabase Auth credentials when configured, or the local development admin.
          </p>
          <label className="field-label mt-8" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="field"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="field-label mt-5" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="field"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          <button className="btn-primary mt-6 w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
