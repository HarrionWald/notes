/** Free-tier ceilings the app enforces. These are not a guarantee that Supabase will always offer them. */
export const SUPABASE_FREE_DATABASE_BYTES = 500 * 1024 * 1024;
export const SUPABASE_FREE_STORAGE_BYTES = 1024 * 1024 * 1024;
export const SUPABASE_FREE_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
export const WARN_UPLOAD_BYTES = 10 * 1024 * 1024;
export const LOCAL_MEDIA_KEEP_BYTES = 2 * 1024 * 1024;
export const MAX_DRAWING_JSON_BYTES = 4 * 1024 * 1024;
export const STORAGE_WARNING_RATIO = 0.8;

export const DEFAULT_PREFERENCES = {
  theme: "system",
  autosaveMs: 800,
  autoSync: true,
  uploadLimitBytes: DEFAULT_UPLOAD_LIMIT_BYTES,
  keepLocalMedia: false,
  stylusOnly: false,
} as const;

export function clampUploadLimit(bytes: number) {
  if (!Number.isFinite(bytes)) return DEFAULT_UPLOAD_LIMIT_BYTES;
  return Math.min(SUPABASE_FREE_MAX_FILE_BYTES, Math.max(1024 * 1024, Math.round(bytes)));
}

export function shouldWarnBeforeUpload(sizeBytes: number, limitBytes: number) {
  return sizeBytes >= Math.min(WARN_UPLOAD_BYTES, limitBytes);
}

export function storageWarning(usedBytes: number, quotaBytes: number) {
  if (usedBytes >= quotaBytes) {
    return "Tracked files are at or above the free storage allowance. Delete recordings or documents before uploading more. Local notes stay on this device.";
  }
  if (usedBytes >= quotaBytes * STORAGE_WARNING_RATIO) {
    return "Tracked files are close to the free storage allowance. Large uploads may fail until you delete older files or the quota resets.";
  }
  return null;
}

export type UsageInput = {
  documents: { sizeBytes: number; deletedAt: string | null; extractedText: string }[];
  recordings: { sizeBytes: number; deletedAt: string | null }[];
  notes: { contentText: string; deletedAt: string | null }[];
  drawings: { pages: unknown; deletedAt: string | null }[];
};

export function estimateUsage(input: UsageInput) {
  const active = <T extends { deletedAt: string | null }>(items: T[]) => items.filter((item) => !item.deletedAt);
  const files =
    active(input.documents).reduce((sum, item) => sum + item.sizeBytes, 0) +
    active(input.recordings).reduce((sum, item) => sum + item.sizeBytes, 0);
  const notes = active(input.notes).reduce((sum, item) => sum + item.contentText.length, 0);
  const drawings = active(input.drawings).reduce((sum, item) => sum + JSON.stringify(item.pages).length, 0);
  return { files, notes, drawings, total: files + notes + drawings };
}
