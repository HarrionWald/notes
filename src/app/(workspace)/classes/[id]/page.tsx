"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function ClassPage() {
  const params = useParams<{ id: string }>();
  const workspace = useWorkspace();
  const router = useRouter();
  const item = workspace.snapshot.classes.find((entry) => entry.id === params.id);
  if (!item || item.deletedAt) return <p className="p-6 text-sm">That class is not available.</p>;
  const notes = workspace.snapshot.notes.filter((note) => note.classId === item.id && !note.deletedAt);
  const documents = workspace.snapshot.documents.filter((document) => document.classId === item.id && !document.deletedAt);
  const recordings = workspace.snapshot.recordings.filter((recording) => recording.classId === item.id && !recording.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <input className="w-full bg-transparent text-3xl font-semibold outline-none" value={item.name} aria-label="Class name" onChange={(event) => void workspace.saveClass({ ...item, name: event.target.value })} />
      <input className="mt-2 w-full bg-transparent text-muted-foreground outline-none" value={item.subject} aria-label="Subject" onChange={(event) => void workspace.saveClass({ ...item, subject: event.target.value })} />
      <div className="mt-4 flex gap-2">
        <Button onClick={() => void workspace.createNote({ classId: item.id }).then((note) => router.push(`/notes/${note.id}`))}>New class note</Button>
        <Button variant="destructive" onClick={() => void workspace.softDelete("classes", item).then(() => router.push("/classes"))}>Move to trash</Button>
      </div>
      <Resource title="Notes" items={notes.map((note) => ({ id: note.id, href: `/notes/${note.id}`, label: note.title }))} />
      <Resource title="Documents" items={documents.map((document) => ({ id: document.id, href: `/documents/${document.id}`, label: document.title }))} />
      <Resource title="Recordings" items={recordings.map((recording) => ({ id: recording.id, href: `/recordings/${recording.id}`, label: recording.title }))} />
    </div>
  );
}

function Resource({ title, items }: { title: string; items: { id: string; href: string; label: string }[] }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing here yet.</p> : (
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {items.map((item) => <li key={item.id}><Link className="block px-4 py-3 hover:bg-accent" href={item.href}>{item.label || "Untitled"}</Link></li>)}
        </ul>
      )}
    </section>
  );
}
