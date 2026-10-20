import type { DocumentKind } from "@/lib/types";
import { SUPABASE_FREE_MAX_FILE_BYTES } from "@/lib/limits";

export type FileCheck = { ok: true; kind: DocumentKind; mimeType: string } | { ok: false; error: string };

const EXTENSIONS: Record<string, { kind: DocumentKind; mimeType: string }> = {
  pdf: { kind: "pdf", mimeType: "application/pdf" },
  docx: { kind: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pptx: { kind: "pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  txt: { kind: "text", mimeType: "text/plain" },
  md: { kind: "text", mimeType: "text/markdown" },
  markdown: { kind: "text", mimeType: "text/markdown" },
  png: { kind: "image", mimeType: "image/png" },
  jpg: { kind: "image", mimeType: "image/jpeg" },
  jpeg: { kind: "image", mimeType: "image/jpeg" },
  webp: { kind: "image", mimeType: "image/webp" },
  gif: { kind: "image", mimeType: "image/gif" },
  webm: { kind: "audio", mimeType: "audio/webm" },
  mp3: { kind: "audio", mimeType: "audio/mpeg" },
  wav: { kind: "audio", mimeType: "audio/wav" },
  m4a: { kind: "audio", mimeType: "audio/mp4" },
  ogg: { kind: "audio", mimeType: "audio/ogg" },
  mp4: { kind: "video", mimeType: "video/mp4" },
  mov: { kind: "video", mimeType: "video/quicktime" },
};

const MIME_KIND: Record<string, DocumentKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "text",
  "text/markdown": "text",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/webm": "audio",
  "audio/mp4": "audio",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/x-m4a": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};

export function extensionOf(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

export function validateFile(input: { name: string; size: number; type: string; limitBytes: number }): FileCheck {
  if (!input.name.trim()) return { ok: false, error: "Choose a file with a name." };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false, error: "The file is empty." };
  const limit = Math.min(input.limitBytes, SUPABASE_FREE_MAX_FILE_BYTES);
  if (input.size > SUPABASE_FREE_MAX_FILE_BYTES) {
    return { ok: false, error: "This file is larger than the 50 MB free Supabase upload limit." };
  }
  if (input.size > limit) {
    return { ok: false, error: "This file is larger than your upload limit in Settings." };
  }
  const extension = extensionOf(input.name);
  const fromExtension = EXTENSIONS[extension];
  const mime = input.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const fromMime = MIME_KIND[mime];
  if (!fromExtension && !fromMime) {
    return {
      ok: false,
      error: "This file type is not supported. Use PDF, DOCX, PPTX, TXT, Markdown, PNG, JPEG, WEBP, GIF, or a common audio or video file.",
    };
  }
  if (fromExtension && fromMime && fromExtension.kind !== fromMime && !(extension === "webm" && (fromMime === "audio" || fromMime === "video"))) {
    return { ok: false, error: "The file extension does not match its type, so it was not imported." };
  }
  if (extension === "webm" && mime.startsWith("video/")) {
    return { ok: true, kind: "video", mimeType: "video/webm" };
  }
  const kind = fromExtension?.kind ?? fromMime ?? "unknown";
  const mimeType = mime && MIME_KIND[mime] ? mime : (fromExtension?.mimeType ?? "application/octet-stream");
  return { ok: true, kind, mimeType };
}

export function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 120) || "file";
}

export function storagePath(userId: string, kind: string, id: string, fileName: string) {
  return `${userId}/${kind}/${id}/${safeFileName(fileName)}`;
}
