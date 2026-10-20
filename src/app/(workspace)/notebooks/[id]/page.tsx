"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function NotebookPage() {
  const params = useParams<{ id: string }>();
  const workspace = useWorkspace();
  const router = useRouter();
  const notebook = workspace.snapshot.notebooks.find((item) => item.id === params.id);
  const [sectionTitle, setSectionTitle] = useState("");
  if (!notebook || notebook.deletedAt) return <p className="p-6 text-sm">That notebook is not available.</p>;
  const sections = workspace.snapshot.sections.filter((section) => section.notebookId === notebook.id && !section.deletedAt);
  const notes = workspace.snapshot.notes.filter((note) => note.notebookId === notebook.id && !note.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <input className="w-full bg-transparent text-3xl font-semibold outline-none" value={notebook.title} aria-label="Notebook title" onChange={(event) => void workspace.saveNotebook({ ...notebook, title: event.target.value })} />
      <textarea className="mt-2 w-full bg-transparent text-sm text-muted-foreground outline-none" value={notebook.description} aria-label="Notebook description" onChange={(event) => void workspace.saveNotebook({ ...notebook, description: event.target.value })} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void workspace.createNote({ notebookId: notebook.id, classId: notebook.classId }).then((note) => router.push(`/notes/${note.id}`))}>New note</Button>
        <Button variant="destructive" onClick={() => void workspace.softDelete("notebooks", notebook).then(() => router.push("/notebooks"))}>Move to trash</Button>
      </div>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!sectionTitle.trim()) return;
          void workspace.createSection(notebook.id, sectionTitle.trim());
          setSectionTitle("");
        }}
      >
        <Input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="New section" aria-label="Section name" />
        <Button type="submit" variant="outline">Add section</Button>
      </form>
      <ul className="mt-3 space-y-2">
        {sections.map((section) => (
          <li key={section.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span>{section.title}</span>
            <Button size="sm" variant="ghost" onClick={() => void workspace.softDelete("sections", section)}>Remove</Button>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Notes</h2>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {notes.map((note) => (
          <li key={note.id}><Link className="block px-4 py-3 hover:bg-accent" href={`/notes/${note.id}`}>{note.title || "Untitled"}</Link></li>
        ))}
      </ul>
    </div>
  );
}
