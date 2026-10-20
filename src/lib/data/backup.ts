import { timestampMs } from "@/lib/utils";
import type { Snapshot, SyncFields } from "@/lib/types";

export const BACKUP_FORMAT = "notes-backup";
export const BACKUP_VERSION = 1;

const ARRAY_KEYS = [
  "classes",
  "folders",
  "notebooks",
  "sections",
  "notes",
  "tags",
  "noteTags",
  "documents",
  "recordings",
  "transcripts",
  "drawings",
  "annotations",
  "favorites",
] as const;

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
} & Pick<Snapshot, (typeof ARRAY_KEYS)[number]>;

export function createBackup(snapshot: Snapshot, exportedAt: string): BackupPayload {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    classes: snapshot.classes,
    folders: snapshot.folders,
    notebooks: snapshot.notebooks,
    sections: snapshot.sections,
    notes: snapshot.notes,
    tags: snapshot.tags,
    noteTags: snapshot.noteTags,
    documents: snapshot.documents,
    recordings: snapshot.recordings,
    transcripts: snapshot.transcripts,
    drawings: snapshot.drawings,
    annotations: snapshot.annotations,
    favorites: snapshot.favorites,
  };
}

export function parseBackup(raw: unknown): { ok: true; backup: BackupPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "That file is not a Notes backup." };
  const value = raw as Record<string, unknown>;
  if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    return { ok: false, error: "This backup version is not supported. Expected notes-backup version 1." };
  }
  const backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "" } as BackupPayload;
  for (const key of ARRAY_KEYS) {
    const list = value[key];
    if (!Array.isArray(list)) return { ok: false, error: `The backup is missing the ${key} list.` };
    const clean = [];
    for (const item of list) {
      if (!item || typeof item !== "object") return { ok: false, error: `A ${key} record was not an object.` };
      const record = item as SyncFields;
      if (typeof record.id !== "string" || typeof record.updatedAt !== "string") {
        return { ok: false, error: `A ${key} record is missing its id or updated time.` };
      }
      clean.push(record);
    }
    Object.assign(backup, { [key]: clean });
  }
  return { ok: true, backup };
}

export function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = map.get(item.id);
    const incomingTime = timestampMs(item.updatedAt) ?? 0;
    const existingTime = existing ? (timestampMs(existing.updatedAt) ?? 0) : -1;
    if (!existing || incomingTime > existingTime) map.set(item.id, item);
  }
  return [...map.values()];
}
