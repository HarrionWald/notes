import type { DrawPage, DrawPoint, Stroke } from "@/lib/types";

export const PAGE_WIDTH = 1000;
export const PAGE_HEIGHT = 1400;

export function blankPage(id: string, paper: DrawPage["paper"] = "lined"): DrawPage {
  return { id, paper, strokes: [], texts: [], images: [] };
}

export function clonePage(page: DrawPage): DrawPage {
  return structuredClone(page);
}

export function hitTestStroke(strokes: Stroke[], point: DrawPoint, padding = 10) {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (!stroke) continue;
    if (stroke.tool === "rect" || stroke.tool === "ellipse") {
      const start = stroke.points[0];
      const end = stroke.points[1];
      if (!start || !end) continue;
      const left = Math.min(start.x, end.x) - padding;
      const right = Math.max(start.x, end.x) + padding;
      const top = Math.min(start.y, end.y) - padding;
      const bottom = Math.max(start.y, end.y) + padding;
      if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return stroke;
      continue;
    }
    for (let pointIndex = 0; pointIndex < stroke.points.length; pointIndex += 1) {
      const current = stroke.points[pointIndex];
      const next = stroke.points[pointIndex + 1] ?? current;
      if (!current || !next) continue;
      if (distanceToSegment(point, current, next) <= stroke.width / 2 + padding) return stroke;
    }
  }
  return null;
}

export function moveStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
  };
}

export function eraseStrokes(strokes: Stroke[], point: DrawPoint, radius: number) {
  return strokes.filter((stroke) => !hitTestStroke([stroke], point, radius));
}

function distanceToSegment(point: DrawPoint, start: DrawPoint, end: DrawPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function drawingByteSize(pages: DrawPage[]) {
  return JSON.stringify(pages).length;
}
