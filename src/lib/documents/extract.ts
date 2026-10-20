import { extractTextFromSlideXml, slideNumberFromPath } from "@/lib/documents/pptx";
import type { DocumentKind, DocumentPage } from "@/lib/types";

export type ExtractionResult = {
  text: string;
  pages: DocumentPage[];
  status: "ready" | "needs_ocr" | "error";
  error: string | null;
};

function joinPages(pages: DocumentPage[]) {
  return pages
    .map((page) => (page.text.trim() ? `${page.label}\n${page.text.trim()}` : ""))
    .filter(Boolean)
    .join("\n\n");
}

export async function extractFile(input: {
  kind: DocumentKind;
  fileName: string;
  data: ArrayBuffer;
  ocrPages?: number[];
  onProgress?: (message: string) => void;
}): Promise<ExtractionResult> {
  try {
    if (input.kind === "text") {
      const text = new TextDecoder().decode(input.data);
      const pages = [{ number: 1, label: "Text", text, method: "text" as const }];
      return { text, pages, status: "ready", error: null };
    }
    if (input.kind === "docx") return extractDocx(input.data);
    if (input.kind === "pptx") return extractPptx(input.data);
    if (input.kind === "pdf") return extractPdf(input.data, input.ocrPages, input.onProgress);
    if (input.kind === "image") {
      if (!input.ocrPages) {
        return {
          text: "",
          pages: [{ number: 1, label: "Image", text: "", method: "none" }],
          status: "needs_ocr",
          error: null,
        };
      }
      const text = await recognizeImage(new Blob([input.data]), input.onProgress);
      const pages = [{ number: 1, label: "Image", text, method: "ocr" as const }];
      return { text, pages, status: text.trim() ? "ready" : "needs_ocr", error: null };
    }
    return {
      text: "",
      pages: [],
      status: "ready",
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The file could not be read.";
    return { text: "", pages: [], status: "error", error: message };
  }
}

async function extractDocx(data: ArrayBuffer): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  const text = result.value.trim();
  return {
    text,
    pages: [{ number: 1, label: "Document", text, method: "text" }],
    status: text ? "ready" : "needs_ocr",
    error: result.messages.map((message) => message.message).join(" ") || null,
  };
}

async function extractPptx(data: ArrayBuffer): Promise<ExtractionResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => (slideNumberFromPath(a) ?? 0) - (slideNumberFromPath(b) ?? 0));
  const pages: DocumentPage[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name]?.async("string");
    if (!xml) continue;
    const number = slideNumberFromPath(name) ?? pages.length + 1;
    pages.push({ number, label: `Slide ${number}`, text: extractTextFromSlideXml(xml), method: "text" });
  }
  const text = joinPages(pages);
  return { text, pages, status: text.trim() ? "ready" : "needs_ocr", error: pages.length ? null : "No slides were found in this PPTX file." };
}

async function extractPdf(data: ArrayBuffer, ocrPages?: number[], onProgress?: (message: string) => void): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: DocumentPage[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    onProgress?.(`Reading page ${number} of ${doc.numPages}`);
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({
      number,
      label: `Page ${number}`,
      text,
      method: text.length > 20 ? "text" : "none",
    });
  }
  if (ocrPages?.length) {
    for (const number of ocrPages) {
      if (number < 1 || number > doc.numPages) continue;
      onProgress?.(`Running local OCR on page ${number}`);
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not prepare the page for OCR."))), "image/png");
      });
      const text = await recognizeImage(blob, onProgress);
      const existing = pages[number - 1];
      if (existing) {
        existing.text = [existing.text, text].filter(Boolean).join("\n");
        existing.method = "ocr";
      }
    }
  }
  const text = joinPages(pages);
  const needsOcr = pages.some((page) => page.method === "none");
  return { text, pages, status: needsOcr && !ocrPages?.length ? "needs_ocr" : "ready", error: null };
}

async function recognizeImage(blob: Blob, onProgress?: (message: string) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status) onProgress?.(`OCR ${message.status}${message.progress ? ` ${Math.round(message.progress * 100)}%` : ""}`);
    },
  });
  try {
    const result = await worker.recognize(blob);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export function parsePageRange(value: string, pageCount: number) {
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(piece);
    if (range?.[1] && range[2]) {
      const start = Math.max(1, Number(range[1]));
      const end = Math.min(pageCount, Number(range[2]));
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    const page = Number(piece);
    if (page >= 1 && page <= pageCount) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
