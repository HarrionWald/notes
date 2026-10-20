"use client";

import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import type { EntityName } from "@/lib/data/rows";
import type { SyncFields } from "@/lib/types";

export default function TrashPage() {
  const workspace = useWorkspace();
  const groups: { entity: EntityName; label: string; records: (SyncFields & { title?: string; name?: string })[] }[] = [
    { entity: "notes", label: "Notes", records: workspace.snapshot.notes },
    { entity: "notebooks", label: "Notebooks", records: workspace.snapshot.notebooks },
    { entity: "classes", label: "Classes", records: workspace.snapshot.classes },
    { entity: "documents", label: "Documents", records: workspace.snapshot.documents },
    { entity: "recordings", label: "Recordings", records: workspace.snapshot.recordings },
    { entity: "drawings", label: "Drawings", records: workspace.snapshot.drawings },
    { entity: "folders", label: "Folders", records: workspace.snapshot.folders },
  ];
  const deleted = groups.flatMap((group) => group.records.filter((record) => record.deletedAt).map((record) => ({ ...group, record })));
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trash</h1>
        <Button variant="destructive" onClick={() => void workspace.emptyTrash()} disabled={deleted.length === 0}>Empty trash</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Restore an item or delete it permanently. Permanent delete also removes a stored audio or document file when one exists.</p>
      {deleted.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">Trash is empty.</p> : null}
      <ul className="mt-4 space-y-2">
        {deleted.map(({ entity, label, record }) => (
          <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
            <span>{label}: {record.title || record.name || "Untitled"}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void workspace.restore(entity, record)}>Restore</Button>
              <Button size="sm" variant="destructive" onClick={() => void workspace.permanentDelete(entity, record)}>Delete forever</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
