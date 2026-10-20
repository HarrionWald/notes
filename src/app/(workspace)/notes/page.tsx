"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { searchItems } from "@/lib/search/search";
import { formatWhen } from "@/lib/utils";

export default function NotesPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("");
  const [notebookId, setNotebookId] = useState("");
  const [tagId, setTagId] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");
  const results = useMemo(() => {
    return searchItems(
      workspace.snapshot.notes.map((note) => ({
        id: note.id,
        kind: "note" as const,
        title: note.title,
        text: note.contentText,
        classId: note.classId,
        notebookId: note.notebookId,
        tagIds: workspace.snapshot.noteTags.filter((link) => link.noteId === note.id && !link.deletedAt).map((link) => link.tagId),
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        deletedAt: note.deletedAt,
      })),
      { query, classId: classId || null, notebookId: notebookId || null, tagId: tagId || null, sort },
    );
  }, [workspace.snapshot, query, classId, notebookId, tagId, sort]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">All notes</h1>
        <Button onClick={() => void workspace.createNote().then((note) => router.push(`/notes/${note.id}`))}>New note</Button>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <input className="h-10 rounded-lg border border-input bg-card px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter" aria-label="Filter notes" />
        <select className="h-10 rounded-lg border border-input bg-card px-2" value={classId} onChange={(event) => setClassId(event.target.value)} aria-label="Filter by class">
          <option value="">All classes</option>
          {workspace.snapshot.classes.filter((item) => !item.deletedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-input bg-card px-2" value={notebookId} onChange={(event) => setNotebookId(event.target.value)} aria-label="Filter by notebook">
          <option value="">All notebooks</option>
          {workspace.snapshot.notebooks.filter((item) => !item.deletedAt).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-input bg-card px-2" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort notes">
          <option value="updated">Modified</option>
          <option value="created">Created</option>
          <option value="title">Title</option>
        </select>
      </div>
      <select className="mb-4 h-10 rounded-lg border border-input bg-card px-2" value={tagId} onChange={(event) => setTagId(event.target.value)} aria-label="Filter by tag">
        <option value="">All tags</option>
        {workspace.snapshot.tags.filter((tag) => !tag.deletedAt).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
      </select>
      {results.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">No notes match these filters.</p> : null}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {results.map((result) => (
          <li key={result.id}>
            <Link href={`/notes/${result.id}`} className="block px-4 py-3 hover:bg-accent">
              <span className="font-medium">{result.title || "Untitled"}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{result.text.slice(0, 120)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{formatWhen(result.updatedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
