"use client";

import { useParams } from "next/navigation";
import { NoteEditor } from "@/components/note-editor";
import { useWorkspace } from "@/components/workspace-provider";

export default function NotePage() {
  const params = useParams<{ id: string }>();
  const note = useWorkspace().snapshot.notes.find((item) => item.id === params.id);
  if (!note || note.deletedAt) return <p className="p-6 text-sm text-muted-foreground">That note is not on this device. If it was deleted, look in Trash.</p>;
  return <NoteEditor key={note.id} note={note} />;
}
