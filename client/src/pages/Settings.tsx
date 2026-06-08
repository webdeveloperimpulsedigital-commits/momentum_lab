import { useEffect, useState } from "react";
import type { Settings as SettingsShape } from "@momentum-lab/shared";
import { api } from "../api";

export function Settings() {
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSettings()
      .then(({ settings }) => setSettings(settings))
      .finally(() => setLoading(false));
  }, []);

  const rows = [
    ["Default model mode", settings?.default_model_mode ?? "Balanced"],
    ["API provider settings", "Coming soon"],
    ["Research depth", settings?.default_research_depth ?? "Standard"],
    [
      "Monthly usage warning",
      settings ? `${settings.monthly_usage_warning_level}%` : "80%"
    ],
    ["Export preferences", "Coming soon"]
  ];

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="text-3xl font-semibold text-white">Settings</h1>
      <p className="mt-2 text-slate-400">
        Placeholder controls for future model, provider, research, usage, and export preferences.
      </p>

      {loading ? <p className="mt-8 text-slate-400">Loading settings...</p> : null}
      <div className="mt-8 divide-y divide-line border border-line">
        {rows.map(([label, value]) => (
          <div className="grid gap-2 p-5 sm:grid-cols-[240px_1fr]" key={label}>
            <p className="text-sm font-medium text-slate-300">{label}</p>
            <p className="text-sm text-slate-400">{value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
