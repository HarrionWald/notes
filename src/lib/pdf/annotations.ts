import type { PdfAnnotationData, PdfRect } from "@/lib/types";

export function emptyAnnotation(): PdfAnnotationData {
  return { highlights: [], ink: [], notes: [] };
}

export function normalizeRect(rect: PdfRect, width: number, height: number): PdfRect {
  return {
    x: clamp(rect.x / width),
    y: clamp(rect.y / height),
    w: clamp(rect.w / width),
    h: clamp(rect.h / height),
  };
}

export function denormalizeRect(rect: PdfRect, width: number, height: number): PdfRect {
  return { x: rect.x * width, y: rect.y * height, w: rect.w * width, h: rect.h * height };
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function addHighlight(data: PdfAnnotationData, highlight: PdfAnnotationData["highlights"][number]): PdfAnnotationData {
  return { ...data, highlights: [...data.highlights, highlight] };
}

export function annotationPageKey(documentId: string, pageNumber: number) {
  return `${documentId}:${pageNumber}`;
}
