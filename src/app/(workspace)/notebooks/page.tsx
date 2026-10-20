"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function NotebooksPage() {
  const workspace = useWorkspace();
  const [title, setTitle] = useState("");
  const notebooks = workspace.snapshot.notebooks.filter((item) => !item.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Notebooks</h1>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void workspace.createNotebook({ title: title.trim() });
          setTitle("");
        }}
      >
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Notebook name" aria-label="Notebook name" />
        <Button type="submit">Create</Button>
      </form>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {notebooks.map((notebook) => (
          <li key={notebook.id}>
            <Link href={`/notebooks/${notebook.id}`} className="block rounded-xl border border-border bg-card p-4 hover:bg-accent">
              <span className="font-medium">{notebook.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{notebook.description || "No description"}</span>
            </Link>
          </li>
        ))}
      </ul>
      {notebooks.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Create a notebook for a course, book, or project.</p> : null}
    </div>
  );
}
