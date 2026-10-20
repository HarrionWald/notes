"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DrawingBoard } from "@/components/drawing-board";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { drawingByteSize } from "@/lib/drawings/model";
import { MAX_DRAWING_JSON_BYTES } from "@/lib/limits";
import type { DrawPage } from "@/lib/types";

export default function HandwritingDocumentPage() {
  const params = useParams<{ id: string }>();
  const workspace = useWorkspace();
  const router = useRouter();
  const drawing = workspace.snapshot.drawings.find((item) => item.id === params.id);
  const drawingId = drawing?.id ?? "";
  const [titleFor, setTitleFor] = useState(drawingId);
  const [title, setTitle] = useState(drawing?.title ?? "");
  const [status, setStatus] = useState("Saved on this device");
  const timer = useRef<number | null>(null);
  if (titleFor !== drawingId) {
    setTitleFor(drawingId);
    setTitle(drawing?.title ?? "");
  }
  if (!drawing || drawing.deletedAt) return <p className="p-6 text-sm">That drawing is not on this device.</p>;

  function savePages(pages: DrawPage[]) {
    if (drawingByteSize(pages) > MAX_DRAWING_JSON_BYTES) {
      setStatus("This drawing is too large to synchronize. It stays on this device. Remove an image or a page before syncing.");
      return;
    }
    setStatus("Saving…");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void workspace.saveDrawing({ ...drawing!, title, pages }).then((result) => {
        setStatus(result === "saved" ? "Saved" : result === "offline" ? "Offline · saved on this device" : "Saved on this device · waiting to synchronize");
      });
    }, 900);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => void workspace.saveDrawing({ ...drawing, title })} aria-label="Drawing title" className="max-w-sm" />
        <select className="h-10 rounded-lg border border-input bg-card px-2" value={drawing.classId ?? ""} onChange={(event) => void workspace.saveDrawing({ ...drawing, classId: event.target.value || null })} aria-label="Class">
          <option value="">No class</option>
          {workspace.snapshot.classes.filter((item) => !item.deletedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-input bg-card px-2" value={drawing.notebookId ?? ""} onChange={(event) => void workspace.saveDrawing({ ...drawing, notebookId: event.target.value || null })} aria-label="Notebook">
          <option value="">No notebook</option>
          {workspace.snapshot.notebooks.filter((item) => !item.deletedAt).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <p className="text-sm text-muted-foreground" role="status">{status}</p>
        <Button variant="destructive" className="ml-auto" onClick={() => void workspace.softDelete("drawings", drawing).then(() => router.push("/handwriting"))}>Trash</Button>
      </div>
      <DrawingBoard key={drawing.id} drawing={{ ...drawing, title }} stylusOnly={workspace.preferences.stylusOnly} onChange={savePages} />
    </div>
  );
}
