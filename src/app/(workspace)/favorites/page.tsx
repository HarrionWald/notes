"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";

const HREFS = {
  note: "/notes/",
  notebook: "/notebooks/",
  document: "/documents/",
  recording: "/recordings/",
  drawing: "/handwriting/",
  class: "/classes/",
} as const;

export default function FavoritesPage() {
  const workspace = useWorkspace();
  const favorites = workspace.snapshot.favorites.filter((item) => !item.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Favorites</h1>
      {favorites.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Star a note to keep it here.</p> : null}
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {favorites.map((favorite) => (
          <li key={favorite.id}>
            <Link className="block px-4 py-3 hover:bg-accent" href={`${HREFS[favorite.targetType]}${favorite.targetId}`}>
              {favorite.targetType} · {labelFor(workspace.snapshot, favorite.targetType, favorite.targetId)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function labelFor(snapshot: ReturnType<typeof useWorkspace>["snapshot"], type: string, id: string) {
  if (type === "note") return snapshot.notes.find((item) => item.id === id)?.title ?? "Note";
  if (type === "notebook") return snapshot.notebooks.find((item) => item.id === id)?.title ?? "Notebook";
  if (type === "document") return snapshot.documents.find((item) => item.id === id)?.title ?? "Document";
  if (type === "recording") return snapshot.recordings.find((item) => item.id === id)?.title ?? "Recording";
  if (type === "drawing") return snapshot.drawings.find((item) => item.id === id)?.title ?? "Drawing";
  if (type === "class") return snapshot.classes.find((item) => item.id === id)?.name ?? "Class";
  return "Item";
}
