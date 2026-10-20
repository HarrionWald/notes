"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { PAGE_HEIGHT, PAGE_WIDTH, blankPage, clonePage, eraseStrokes, hitTestStroke, moveStroke } from "@/lib/drawings/model";
import type { DrawPage, DrawPoint, DrawTool, Drawing, PaperStyle, Stroke } from "@/lib/types";
import { createId } from "@/lib/utils";

const COLORS = ["#1c1917", "#0f5e5b", "#b42318", "#1d4ed8", "#a16207", "#7c3aed"];

export function DrawingBoard({
  drawing,
  stylusOnly,
  onChange,
}: {
  drawing: Drawing;
  stylusOnly: boolean;
  onChange: (pages: DrawPage[]) => void;
}) {
  const [pages, setPages] = useState<DrawPage[]>(drawing.pages.length ? drawing.pages : [blankPage(createId(), "lined")]);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState(COLORS[0] ?? "#1c1917");
  const [width, setWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Stroke | null>(null);
  const undo = useRef<DrawPage[][]>([]);
  const redo = useRef<DrawPage[][]>([]);
  const penDown = useRef(false);
  const selected = useRef<string | null>(null);
  const lastPoint = useRef<DrawPoint | null>(null);
  const page = pages[index] ?? pages[0];

  useEffect(() => {
    paint();
  });

  function commit(next: DrawPage[]) {
    setPages(next);
    onChange(next);
  }

  function snapshot() {
    undo.current.push(pages.map(clonePage));
    if (undo.current.length > 40) undo.current.shift();
    redo.current = [];
  }

  function updatePage(mutator: (page: DrawPage) => DrawPage) {
    const next = pages.map((item, itemIndex) => (itemIndex === index ? mutator(item) : item));
    commit(next);
  }

  function paint() {
    const canvas = canvasRef.current;
    const current = pages[index];
    if (!canvas || !current) return;
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = PAGE_WIDTH * zoom;
    const cssHeight = PAGE_HEIGHT * zoom;
    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio * zoom, 0, 0, ratio * zoom, 0, 0);
    drawPaper(ctx, current.paper);
    for (const image of current.images) {
      const element = document.querySelector<HTMLImageElement>(`img[data-draw="${image.id}"]`);
      if (element?.complete) ctx.drawImage(element, image.x, image.y, image.width, image.height);
    }
    for (const stroke of [...current.strokes, ...(draft.current ? [draft.current] : [])]) drawStroke(ctx, stroke);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function localPoint(event: React.PointerEvent<HTMLCanvasElement>): DrawPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
      p: event.pressure && event.pressure > 0 ? event.pressure : 0.5,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (stylusOnly && event.pointerType === "touch") return;
    if (penDown.current && event.pointerType === "touch") return;
    if (event.pointerType === "pen") penDown.current = true;
    const point = localPoint(event);
    const current = pages[index];
    if (!current) return;
    if (tool === "pan") return;
    snapshot();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "eraser") {
      updatePage((item) => ({ ...item, strokes: eraseStrokes(item.strokes, point, width * 3) }));
      lastPoint.current = point;
      return;
    }
    if (tool === "select") {
      const hit = hitTestStroke(current.strokes, point, 12);
      selected.current = hit?.id ?? null;
      lastPoint.current = point;
      return;
    }
    if (tool === "text") {
      updatePage((item) => ({
        ...item,
        texts: [...item.texts, { id: createId(), x: point.x, y: point.y, width: 280, height: 80, text: "Text", color, fontSize: 22 }],
      }));
      return;
    }
    const strokeTool = tool === "highlighter" || tool === "line" || tool === "arrow" || tool === "rect" || tool === "ellipse" ? tool : "pen";
    draft.current = { id: createId(), tool: strokeTool, color, width: tool === "highlighter" ? width * 4 : width, points: [point] };
    lastPoint.current = point;
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (stylusOnly && event.pointerType === "touch") return;
    if (penDown.current && event.pointerType === "touch") return;
    const point = localPoint(event);
    const current = pages[index];
    if (!current || !lastPoint.current) return;
    if (tool === "eraser" && event.buttons) {
      updatePage((item) => ({ ...item, strokes: eraseStrokes(item.strokes, point, width * 3) }));
    } else if (tool === "select" && selected.current && event.buttons) {
      const dx = point.x - lastPoint.current.x;
      const dy = point.y - lastPoint.current.y;
      updatePage((item) => ({ ...item, strokes: item.strokes.map((stroke) => (stroke.id === selected.current ? moveStroke(stroke, dx, dy) : stroke)) }));
    } else if (draft.current && event.buttons) {
      const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
      const points = events.map((item) => localPoint({ ...event, clientX: item.clientX, clientY: item.clientY, pressure: item.pressure } as React.PointerEvent<HTMLCanvasElement>));
      if (draft.current.tool === "pen" || draft.current.tool === "highlighter") draft.current.points.push(...points);
      else draft.current.points = [draft.current.points[0] ?? point, point];
      paint();
    }
    lastPoint.current = point;
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "pen") penDown.current = false;
    if (draft.current) {
      const stroke = draft.current;
      draft.current = null;
      updatePage((item) => ({ ...item, strokes: [...item.strokes, stroke] }));
    }
    lastPoint.current = null;
  }

  async function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${drawing.title || "drawing"}-page-${index + 1}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    for (const item of pages) {
      const canvas = document.createElement("canvas");
      canvas.width = PAGE_WIDTH;
      canvas.height = PAGE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      drawPaper(ctx, item.paper);
      for (const stroke of item.strokes) drawStroke(ctx, stroke);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) continue;
      const image = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
      const pdfPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }
    const bytes = await pdf.save();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${drawing.title || "drawing"}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!page) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {(["pen", "highlighter", "eraser", "select", "text", "line", "arrow", "rect", "ellipse", "pan"] as DrawTool[]).map((item) => (
          <Button key={item} size="sm" variant={tool === item ? "default" : "ghost"} onClick={() => setTool(item)} aria-pressed={tool === item}>
            {item}
          </Button>
        ))}
        {COLORS.map((item) => (
          <button key={item} aria-label={`Color ${item}`} className="h-6 w-6 rounded-full border border-border" style={{ background: item, outline: color === item ? "2px solid var(--ring)" : undefined }} onClick={() => setColor(item)} />
        ))}
        <label className="flex items-center gap-2 text-xs">
          Width
          <input type="range" min={1} max={24} value={width} onChange={(event) => setWidth(Number(event.target.value))} aria-label="Stroke width" />
        </label>
        <label className="text-xs">
          Paper
          <select className="ml-1 h-8 rounded-md border border-input bg-card px-2" value={page.paper} onChange={(event) => updatePage((item) => ({ ...item, paper: event.target.value as PaperStyle }))}>
            <option value="blank">Blank</option>
            <option value="lined">Lined</option>
            <option value="dotted">Dotted</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}>Zoom in</Button>
        <Button size="sm" variant="outline" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>Zoom out</Button>
        <Button size="sm" variant="outline" onClick={() => { const previous = undo.current.pop(); if (!previous) return; redo.current.push(pages.map(clonePage)); commit(previous); }}>Undo</Button>
        <Button size="sm" variant="outline" onClick={() => { const next = redo.current.pop(); if (!next) return; undo.current.push(pages.map(clonePage)); commit(next); }}>Redo</Button>
        <Button size="sm" variant="outline" onClick={() => void exportPng()}>PNG</Button>
        <Button size="sm" variant="outline" onClick={() => void exportPdf()}>PDF</Button>
        <label className="text-xs">
          Image
          <input
            className="ml-1 text-xs"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const href = String(reader.result ?? "");
                updatePage((item) => ({ ...item, images: [...item.images, { id: createId(), x: 80, y: 80, width: 320, height: 220, href }] }));
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
      <p className="px-3 py-1 text-xs text-muted-foreground">
        Stylus-only mode ignores finger drawing so you can rest your palm and scroll. This is a browser approximation, not the same palm rejection as a native iPad app. Pressure is used when the browser provides it.
      </p>
      <div className="flex min-h-0 flex-1 gap-3 overflow-auto p-3">
        <div className="relative mx-auto">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="rounded-lg border border-border bg-white shadow-sm"
            style={{ touchAction: tool === "pan" || stylusOnly ? "pan-y" : "none" }}
          />
          {page.texts.map((text) => (
            <textarea
              key={text.id}
              value={text.text}
              aria-label="Text box"
              onChange={(event) => updatePage((item) => ({ ...item, texts: item.texts.map((entry) => (entry.id === text.id ? { ...entry, text: event.target.value } : entry)) }))}
              className="absolute bg-transparent font-serif outline-none"
              style={{ left: `${(text.x / PAGE_WIDTH) * 100}%`, top: `${(text.y / PAGE_HEIGHT) * 100}%`, width: `${(text.width / PAGE_WIDTH) * 100}%`, color: text.color, fontSize: text.fontSize * zoom }}
            />
          ))}
          {page.images.map((image) => (
            // Hidden images give the canvas something to draw. The visible pixels are painted on the canvas.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={image.id} data-draw={image.id} src={image.href} alt="" className="hidden" />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-auto border-t border-border px-3 py-2">
        {pages.map((item, itemIndex) => (
          <Button key={item.id} size="sm" variant={itemIndex === index ? "default" : "outline"} onClick={() => setIndex(itemIndex)}>
            {itemIndex + 1}
          </Button>
        ))}
        <Button size="sm" variant="secondary" onClick={() => { const next = [...pages, blankPage(createId(), page.paper)]; setIndex(next.length - 1); commit(next); }}>Add page</Button>
      </div>
    </div>
  );
}

function drawPaper(ctx: CanvasRenderingContext2D, paper: PaperStyle) {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  ctx.strokeStyle = "#e7e1d6";
  ctx.lineWidth = 1;
  if (paper === "lined") {
    for (let y = 72; y < PAGE_HEIGHT; y += 32) {
      ctx.beginPath();
      ctx.moveTo(48, y);
      ctx.lineTo(PAGE_WIDTH - 48, y);
      ctx.stroke();
    }
  }
  if (paper === "grid") {
    for (let y = 40; y < PAGE_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PAGE_WIDTH, y);
      ctx.stroke();
    }
    for (let x = 40; x < PAGE_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, PAGE_HEIGHT);
      ctx.stroke();
    }
  }
  if (paper === "dotted") {
    ctx.fillStyle = "#d6d0c6";
    for (let y = 40; y < PAGE_HEIGHT; y += 28) {
      for (let x = 40; x < PAGE_WIDTH; x += 28) ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  if (!start || !end) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.35 : 1;
  ctx.lineWidth = stroke.width;
  if (stroke.tool === "line" || stroke.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (stroke.tool === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - 14 * Math.cos(angle - 0.4), end.y - 14 * Math.sin(angle - 0.4));
      ctx.lineTo(end.x - 14 * Math.cos(angle + 0.4), end.y - 14 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }
  } else if (stroke.tool === "rect") {
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (stroke.tool === "ellipse") {
    ctx.beginPath();
    ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.restore();
}
