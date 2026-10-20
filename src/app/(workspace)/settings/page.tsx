"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Button, Input, Switch } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { SUPABASE_FREE_DATABASE_BYTES, SUPABASE_FREE_MAX_FILE_BYTES, SUPABASE_FREE_STORAGE_BYTES, storageWarning } from "@/lib/limits";
import { formatBytes } from "@/lib/utils";

export default function SettingsPage() {
  const workspace = useWorkspace();
  const theme = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const warning = storageWarning(workspace.usage.files, SUPABASE_FREE_STORAGE_BYTES);
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{workspace.user ? workspace.user.email : "Local only — not synchronized"}</p>
      </header>
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Appearance</h2>
        <label className="mt-3 block text-sm">
          Theme
          <select
            className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-2"
            value={theme.theme}
            onChange={(event) => {
              const value = event.target.value as "light" | "dark" | "system";
              theme.setTheme(value);
              workspace.setPreferences({ theme: value });
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Saving and sync</h2>
        <label className="mt-3 block text-sm">
          Autosave delay (milliseconds)
          <Input
            type="number"
            min={400}
            max={5000}
            value={workspace.preferences.autosaveMs}
            onChange={(event) => workspace.setPreferences({ autosaveMs: Number(event.target.value) || 800 })}
          />
        </label>
        <Switch checked={workspace.preferences.autoSync} onCheckedChange={(checked) => workspace.setPreferences({ autoSync: checked })} label="Synchronize when online" />
        <Switch checked={workspace.preferences.stylusOnly} onCheckedChange={(checked) => workspace.setPreferences({ stylusOnly: checked })} label="Stylus-only drawing (finger scrolls instead of drawing)" />
        <Switch checked={workspace.preferences.keepLocalMedia} onCheckedChange={(checked) => workspace.setPreferences({ keepLocalMedia: checked })} label="Keep local copies of uploaded audio and documents" />
        <label className="mt-3 block text-sm">
          Upload limit, up to {formatBytes(SUPABASE_FREE_MAX_FILE_BYTES)}
          <Input
            type="number"
            min={1}
            max={50}
            value={Math.round(workspace.preferences.uploadLimitBytes / (1024 * 1024))}
            onChange={(event) => workspace.setPreferences({ uploadLimitBytes: Number(event.target.value) * 1024 * 1024 })}
          />
        </label>
        <Button className="mt-3" variant="outline" onClick={() => void workspace.syncNow()}>Sync now</Button>
        <p className="mt-2 text-sm text-muted-foreground">{workspace.pending} waiting · last sync {workspace.lastSyncedAt ?? "not yet"}</p>
      </section>
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Storage tracked by this app</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Files: {formatBytes(workspace.usage.files)} of about {formatBytes(SUPABASE_FREE_STORAGE_BYTES)} free storage</li>
          <li>Note text: {formatBytes(workspace.usage.notes)}</li>
          <li>Drawings: {formatBytes(workspace.usage.drawings)}</li>
          <li>Database allowance is about {formatBytes(SUPABASE_FREE_DATABASE_BYTES)} per free project</li>
        </ul>
        {warning ? <p className="mt-3 text-sm">{warning}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">These are estimates from your notes, not a live bill. The free plan can pause after a week of inactivity and quotas can change. This app will not upgrade the plan.</p>
      </section>
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Backup</h2>
        <p className="mt-2 text-sm text-muted-foreground">The JSON backup includes notes, organization, transcripts, annotations, and drawing strokes. Audio and document binaries are not embedded, so import them again if you move devices.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => workspace.exportData()}>Export JSON</Button>
          <label className="inline-flex items-center">
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const error = await workspace.importData(JSON.parse(text));
                  setMessage(error);
                } catch {
                  setMessage("That file is not valid JSON.");
                }
              }}
            />
            <span className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm">Import JSON</span>
          </label>
        </div>
        {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
      </section>
      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Account</h2>
        {workspace.configured ? (
          <div className="mt-3 flex gap-2">
            {workspace.user ? <Button variant="outline" onClick={() => void workspace.signOut()}>Sign out</Button> : null}
          </div>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Create a free project at supabase.com. Do not add a payment method.</li>
            <li>Copy the project URL and anon key into `.env.local`.</li>
            <li>Run `supabase/migrations/0001_init.sql` in the SQL editor.</li>
            <li>In Authentication, keep Email enabled. Turn off Confirm email for a personal account, or use the same email as your Supabase login. The built-in mailer only delivers to your team and is limited to about 2 emails an hour.</li>
            <li>Restart `npm run dev`.</li>
          </ol>
        )}
      </section>
      <section className="rounded-xl border border-border p-4 text-sm">
        <h2 className="font-semibold">Keyboard shortcuts</h2>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>Ctrl or Cmd + N — new note</li>
          <li>Ctrl or Cmd + K — search</li>
          <li>Ctrl or Cmd + S — save the open note</li>
          <li>Ctrl or Cmd + \ — collapse the sidebar</li>
          <li>Ctrl or Cmd + B, I, U — bold, italic, underline</li>
          <li>Ctrl or Cmd + Z — undo</li>
        </ul>
      </section>
    </div>
  );
}
