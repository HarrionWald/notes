"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { formatWhen } from "@/lib/utils";
import { SUPABASE_FREE_STORAGE_BYTES, storageWarning } from "@/lib/limits";

export default function HomePage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const notes = workspace.snapshot.notes.filter((note) => !note.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const warning = storageWarning(workspace.usage.files, SUPABASE_FREE_STORAGE_BYTES);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Your study desk</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Write notes, keep lecture audio, extract text from documents, and handwrite on a page. Nothing here calls a paid AI API.
      </p>
      {warning ? <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">{warning}</p> : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => void workspace.createNote().then((note) => router.push(`/notes/${note.id}`))}>New note</Button>
        <Button variant="outline" onClick={() => router.push("/recordings")}>Record</Button>
        <Button variant="outline" onClick={() => router.push("/documents")}>Import</Button>
        <Button variant="outline" onClick={() => router.push("/handwriting")}>Handwrite</Button>
      </div>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Recent notes</h2>
        {notes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">No notes yet. Create one and it will stay on this device even if you are offline.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {notes.slice(0, 8).map((note) => (
              <li key={note.id}>
                <Link href={`/notes/${note.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
                  <span>
                    <span className="block font-medium">{note.title || "Untitled"}</span>
                    <span className="block text-sm text-muted-foreground">{note.contentText.slice(0, 90)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(note.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
