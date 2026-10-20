"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { emptyAnnotation, normalizeRect } from "@/lib/pdf/annotations";
import type { PdfAnnotationData, PdfRect, Stroke } from "@/lib/types";
import { createId } from "@/lib/utils";

type TextItem = { str: string; x: number; y: number; w: number; h: number };

export function PdfReader({
  data,
  annotations,
  onAnnotation,
  onCreateNote,
}: {
  data: ArrayBuffer;
  annotations: { pageNumber: number; data: PdfAnnotationData }[];
  onAnnotation: (data: PdfAnnotationData, pageNumber: number) => void;
  onCreateNote: (text: string, pageNumber: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<TextItem[]>([]);
  const [pageText, setPageText] = useState("");
  const [tool, setTool] = useState<"select" | "ink" | "note">("select");
  const [color, setColor] = useState("#f5d90a");
  const [message, setMessage] = useState<string | null>(null);
  const draft = useRef<Stroke | null>(null);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const annotation = annotations.find((item) => item.pageNumber === pageNumber)?.data ?? emptyAnnotation();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
      if (cancelled) return;
      docRef.current = doc;
      setPageCount(doc.numPages);
    }
    void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "This PDF could not be opened."));
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const doc = docRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: zoom });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ink = inkRef.current;
      if (ink) {
        ink.width = canvas.width;
        ink.height = canvas.height;
      }
      await page.render({ canvas, viewport }).promise;
      const content = await page.getTextContent();
      const nextItems: TextItem[] = [];
      const parts: string[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        const tx = multiply(viewport.transform, item.transform);
        const height = Math.hypot(tx[2] ?? 0, tx[3] ?? 0) || 12;
        nextItems.push({ str: item.str, x: tx[4] ?? 0, y: (tx[5] ?? 0) - height, w: item.width * zoom, h: height });
        parts.push(item.str);
      }
      if (!cancelled) {
        setItems(nextItems);
        setPageText(parts.join(" "));
      }
    }
    void render().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "This page could not be drawn."));
    return () => {
      cancelled = true;
    };
  }, [pageNumber, zoom, pageCount]);

  function paintInk() {
    const ink = inkRef.current;
    if (!ink) return;
    const ctx = ink.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ink.width, ink.height);
    for (const stroke of [...annotation.ink, ...(draft.current ? [draft.current] : [])]) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * ink.width;
        const y = point.y * ink.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  useEffect(() => {
    paintInk();
  });

  function highlightSelection() {
    const selection = window.getSelection();
    const wrap = wrapRef.current;
    if (!selection || selection.isCollapsed || !wrap) return;
    const range = selection.getRangeAt(0);
    const box = wrap.getBoundingClientRect();
    const rects: PdfRect[] = [];
    for (const rect of range.getClientRects()) {
      rects.push(normalizeRect({ x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height }, box.width, box.height));
    }
    if (!rects.length) return;
    onAnnotation(
      {
        ...annotation,
        highlights: [...annotation.highlights, { id: createId(), color, rects, text: selection.toString() }],
      },
      pageNumber,
    );
    selection.removeAllRanges();
  }

  function pointerPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, p: event.pressure || 0.5 };
  }

  const matches = query.trim() ? items.filter((item) => item.str.toLowerCase().includes(query.trim().toLowerCase())) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} aria-label="Previous page">Prev</Button>
          <span className="text-sm">{pageNumber} / {pageCount}</span>
          <Button size="sm" variant="outline" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))} aria-label="Next page">Next</Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>Zoom out</Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))}>Zoom in</Button>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this page" aria-label="Search PDF text" />
        <p className="text-xs text-muted-foreground">{matches.length ? `${matches.length} match${matches.length === 1 ? "" : "es"} on this page` : "Search looks through selectable text. OCR text is labeled separately on the document page."}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>Select</Button>
          <Button size="sm" variant={tool === "ink" ? "default" : "outline"} onClick={() => setTool("ink")}>Draw</Button>
          <Button size="sm" variant={tool === "note" ? "default" : "outline"} onClick={() => setTool("note")}>Note</Button>
        </div>
        <label className="block text-xs">
          Color
          <input className="ml-2" type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Annotation color" />
        </label>
        <Button size="sm" onClick={highlightSelection}>Highlight selection</Button>
        <Button size="sm" variant="outline" onClick={() => onCreateNote(pageText, pageNumber)}>Create note from this page</Button>
          <Button size="sm" variant="outline" onClick={() => onAnnotation(emptyAnnotation(), pageNumber)}>
          Clear this page’s annotations
        </Button>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </aside>
      <div ref={wrapRef} className="relative overflow-auto rounded-xl border border-border bg-secondary p-3">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block bg-white" />
          <div className="pdf-text-layer pointer-events-none absolute inset-0">
            {items.map((item, index) => (
              <span key={`${item.x}-${item.y}-${index}`} style={{ left: item.x, top: item.y, fontSize: item.h, pointerEvents: tool === "select" ? "auto" : "none" }}>
                {item.str}
              </span>
            ))}
          </div>
          {matches.map((item, index) => (
            <div key={`match-${index}`} className="pointer-events-none absolute bg-primary/30" style={{ left: item.x, top: item.y, width: item.w, height: item.h }} />
          ))}
          {annotation.highlights.map((highlight) =>
            highlight.rects.map((rect, index) => (
              <div key={`${highlight.id}-${index}`} className="pointer-events-none absolute" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, background: highlight.color, opacity: 0.35 }} />
            )),
          )}
          {annotation.notes.map((note) => (
            <div key={note.id} className="absolute max-w-40 rounded-md border border-border bg-card p-2 text-xs shadow" style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}>
              {note.text}
            </div>
          ))}
          <canvas
            ref={inkRef}
            className="absolute inset-0"
            style={{ pointerEvents: tool === "select" ? "none" : "auto", touchAction: "none" }}
            onPointerDown={(event) => {
              const point = pointerPoint(event);
              if (tool === "note") {
                const text = window.prompt("Note for this page");
                if (text) onAnnotation({ ...annotation, notes: [...annotation.notes, { id: createId(), x: point.x, y: point.y, text, color }] }, pageNumber);
                return;
              }
              if (tool !== "ink") return;
              draft.current = { id: createId(), tool: "pen", color, width: 2, points: [point] };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!draft.current || !event.buttons) return;
              draft.current.points.push(pointerPoint(event));
              paintInk();
            }}
            onPointerUp={() => {
              if (!draft.current) return;
              const stroke = draft.current;
              draft.current = null;
              onAnnotation({ ...annotation, ink: [...annotation.ink, stroke] }, pageNumber);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function multiply(m1: number[], m2: number[]) {
  return [
    (m1[0] ?? 0) * (m2[0] ?? 0) + (m1[2] ?? 0) * (m2[1] ?? 0),
    (m1[1] ?? 0) * (m2[0] ?? 0) + (m1[3] ?? 0) * (m2[1] ?? 0),
    (m1[0] ?? 0) * (m2[2] ?? 0) + (m1[2] ?? 0) * (m2[3] ?? 0),
    (m1[1] ?? 0) * (m2[2] ?? 0) + (m1[3] ?? 0) * (m2[3] ?? 0),
    (m1[0] ?? 0) * (m2[4] ?? 0) + (m1[2] ?? 0) * (m2[5] ?? 0) + (m1[4] ?? 0),
    (m1[1] ?? 0) * (m2[4] ?? 0) + (m1[3] ?? 0) * (m2[5] ?? 0) + (m1[5] ?? 0),
  ];
}
