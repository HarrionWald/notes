import { openDB, type IDBPDatabase } from "idb";
import type { EntityName, OutboxItem, BlobRecord, MetaRecord } from "@/lib/data/rows";
import { ENTITY_ORDER } from "@/lib/data/rows";
import type { ConflictRecord, Snapshot, SyncFields } from "@/lib/types";

type StoreName = EntityName | "conflicts" | "outbox" | "blobs" | "meta";

export type NotesDB = {
  classes: { key: string; value: SyncFields };
  folders: { key: string; value: SyncFields };
  notebooks: { key: string; value: SyncFields };
  sections: { key: string; value: SyncFields };
  notes: { key: string; value: SyncFields };
  tags: { key: string; value: SyncFields };
  noteTags: { key: string; value: SyncFields };
  documents: { key: string; value: SyncFields };
  recordings: { key: string; value: SyncFields };
  transcripts: { key: string; value: SyncFields };
  drawings: { key: string; value: SyncFields };
  annotations: { key: string; value: SyncFields };
  favorites: { key: string; value: SyncFields };
  conflicts: { key: string; value: ConflictRecord };
  outbox: { key: string; value: OutboxItem };
  blobs: { key: string; value: BlobRecord };
  meta: { key: string; value: MetaRecord };
};

const STORES: StoreName[] = [...ENTITY_ORDER, "conflicts", "outbox", "blobs", "meta"];

let database: Promise<IDBPDatabase<NotesDB>> | null = null;

export function getDb() {
  if (!database) {
    database = openDB<NotesDB>("notes", 1, {
      upgrade(db) {
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
      },
    });
  }
  return database;
}

export async function readSnapshot(): Promise<Snapshot> {
  const db = await getDb();
  const [classes, folders, notebooks, sections, notes, tags, noteTags, documents, recordings, transcripts, drawings, annotations, favorites, conflicts] =
    await Promise.all([
      db.getAll("classes"),
      db.getAll("folders"),
      db.getAll("notebooks"),
      db.getAll("sections"),
      db.getAll("notes"),
      db.getAll("tags"),
      db.getAll("noteTags"),
      db.getAll("documents"),
      db.getAll("recordings"),
      db.getAll("transcripts"),
      db.getAll("drawings"),
      db.getAll("annotations"),
      db.getAll("favorites"),
      db.getAll("conflicts"),
    ]);
  return {
    classes: classes as Snapshot["classes"],
    folders: folders as Snapshot["folders"],
    notebooks: notebooks as Snapshot["notebooks"],
    sections: sections as Snapshot["sections"],
    notes: notes as Snapshot["notes"],
    tags: tags as Snapshot["tags"],
    noteTags: noteTags as Snapshot["noteTags"],
    documents: documents as Snapshot["documents"],
    recordings: recordings as Snapshot["recordings"],
    transcripts: transcripts as Snapshot["transcripts"],
    drawings: drawings as Snapshot["drawings"],
    annotations: annotations as Snapshot["annotations"],
    favorites: favorites as Snapshot["favorites"],
    conflicts,
  };
}

export function snapshotList(snapshot: Snapshot, entity: EntityName) {
  switch (entity) {
    case "classes":
      return snapshot.classes;
    case "folders":
      return snapshot.folders;
    case "notebooks":
      return snapshot.notebooks;
    case "sections":
      return snapshot.sections;
    case "notes":
      return snapshot.notes;
    case "tags":
      return snapshot.tags;
    case "noteTags":
      return snapshot.noteTags;
    case "documents":
      return snapshot.documents;
    case "recordings":
      return snapshot.recordings;
    case "transcripts":
      return snapshot.transcripts;
    case "drawings":
      return snapshot.drawings;
    case "annotations":
      return snapshot.annotations;
    case "favorites":
      return snapshot.favorites;
  }
}
