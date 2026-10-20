import { emptyDoc } from "@/lib/notes/text";
import { emptyAnnotation } from "@/lib/pdf/annotations";
import type {
  ClassItem,
  ConflictRecord,
  DocumentPage,
  DocumentRecord,
  Drawing,
  DrawPage,
  Favorite,
  Folder,
  Note,
  NoteContent,
  NoteTag,
  PdfAnnotation,
  PdfAnnotationData,
  Recording,
  Section,
  SyncFields,
  Tag,
  Transcript,
  TranscriptSegment,
  UploadStatus,
} from "@/lib/types";

export type EntityName =
  | "classes"
  | "folders"
  | "notebooks"
  | "sections"
  | "notes"
  | "tags"
  | "noteTags"
  | "documents"
  | "recordings"
  | "transcripts"
  | "drawings"
  | "annotations"
  | "favorites";

export const ENTITY_ORDER: EntityName[] = [
  "classes",
  "folders",
  "notebooks",
  "sections",
  "tags",
  "documents",
  "notes",
  "noteTags",
  "recordings",
  "transcripts",
  "drawings",
  "annotations",
  "favorites",
];

export const TABLE_NAMES: Record<EntityName, string> = {
  classes: "classes",
  folders: "folders",
  notebooks: "notebooks",
  sections: "sections",
  notes: "notes",
  tags: "tags",
  noteTags: "note_tags",
  documents: "documents",
  recordings: "recordings",
  transcripts: "transcripts",
  drawings: "drawings",
  annotations: "pdf_annotations",
  favorites: "favorites",
};

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function syncFrom(row: Record<string, unknown>): SyncFields {
  const updatedAt = str(row.updated_at, str(row.updatedAt, new Date(0).toISOString()));
  return {
    id: str(row.id),
    userId: str(row.user_id, str(row.userId)),
    createdAt: str(row.created_at, str(row.createdAt, updatedAt)),
    updatedAt,
    baseUpdatedAt: updatedAt,
    deletedAt: strOrNull(row.deleted_at ?? row.deletedAt),
  };
}

function syncTo(item: SyncFields) {
  return {
    id: item.id,
    user_id: item.userId,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt,
  };
}

export function classToRow(item: ClassItem) {
  return { ...syncTo(item), name: item.name, subject: item.subject, color: item.color, description: item.description };
}
export function classFromRow(row: Record<string, unknown>): ClassItem {
  return { ...syncFrom(row), name: str(row.name, "Untitled class"), subject: str(row.subject), color: str(row.color, "#0f6e6b"), description: str(row.description) };
}

export function folderToRow(item: Folder) {
  return { ...syncTo(item), parent_id: item.parentId, name: item.name };
}
export function folderFromRow(row: Record<string, unknown>): Folder {
  return { ...syncFrom(row), parentId: strOrNull(row.parent_id ?? row.parentId), name: str(row.name, "Folder") };
}

export function notebookToRow(item: import("@/lib/types").Notebook) {
  return { ...syncTo(item), class_id: item.classId, folder_id: item.folderId, title: item.title, description: item.description, color: item.color };
}
export function notebookFromRow(row: Record<string, unknown>): import("@/lib/types").Notebook {
  return {
    ...syncFrom(row),
    classId: strOrNull(row.class_id ?? row.classId),
    folderId: strOrNull(row.folder_id ?? row.folderId),
    title: str(row.title, "Untitled notebook"),
    description: str(row.description),
    color: str(row.color, "#0f6e6b"),
  };
}

export function sectionToRow(item: Section) {
  return { ...syncTo(item), notebook_id: item.notebookId, parent_id: item.parentId, title: item.title, position: item.position };
}
export function sectionFromRow(row: Record<string, unknown>): Section {
  return {
    ...syncFrom(row),
    notebookId: str(row.notebook_id ?? row.notebookId),
    parentId: strOrNull(row.parent_id ?? row.parentId),
    title: str(row.title, "Section"),
    position: num(row.position),
  };
}

export function noteToRow(item: Note) {
  return {
    ...syncTo(item),
    notebook_id: item.notebookId,
    section_id: item.sectionId,
    class_id: item.classId,
    folder_id: item.folderId,
    title: item.title,
    content: item.content,
    content_text: item.contentText,
    word_count: item.wordCount,
    template_type: item.templateType,
    source_document_id: item.sourceDocumentId,
  };
}
export function noteFromRow(row: Record<string, unknown>): Note {
  const content = row.content && typeof row.content === "object" ? (row.content as NoteContent) : emptyDoc();
  return {
    ...syncFrom(row),
    notebookId: strOrNull(row.notebook_id ?? row.notebookId),
    sectionId: strOrNull(row.section_id ?? row.sectionId),
    classId: strOrNull(row.class_id ?? row.classId),
    folderId: strOrNull(row.folder_id ?? row.folderId),
    title: str(row.title, "Untitled"),
    content: content.type === "doc" ? content : emptyDoc(),
    contentText: str(row.content_text ?? row.contentText),
    wordCount: num(row.word_count ?? row.wordCount),
    templateType: strOrNull(row.template_type ?? row.templateType),
    sourceDocumentId: strOrNull(row.source_document_id ?? row.sourceDocumentId),
  };
}

export function tagToRow(item: Tag) {
  return { ...syncTo(item), name: item.name, color: item.color };
}
export function tagFromRow(row: Record<string, unknown>): Tag {
  return { ...syncFrom(row), name: str(row.name, "tag"), color: str(row.color, "#78716c") };
}

export function noteTagToRow(item: NoteTag) {
  return { ...syncTo(item), note_id: item.noteId, tag_id: item.tagId };
}
export function noteTagFromRow(row: Record<string, unknown>): NoteTag {
  return { ...syncFrom(row), noteId: str(row.note_id ?? row.noteId), tagId: str(row.tag_id ?? row.tagId) };
}

function uploadStatus(value: unknown): UploadStatus {
  const status = str(value);
  if (status === "uploading" || status === "uploaded" || status === "error" || status === "local" || status === "pending") return status;
  return "pending";
}

export function documentToRow(item: DocumentRecord) {
  return {
    ...syncTo(item),
    folder_id: item.folderId,
    class_id: item.classId,
    notebook_id: item.notebookId,
    title: item.title,
    file_name: item.fileName,
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    storage_path: item.storagePath,
    kind: item.kind,
    extracted_text: item.extractedText,
    pages: item.pages,
    extraction_status: item.extractionStatus,
    extraction_error: item.extractionError,
    upload_status: item.uploadStatus,
    upload_error: item.uploadError,
  };
}
export function documentFromRow(row: Record<string, unknown>): DocumentRecord {
  const pages = Array.isArray(row.pages) ? (row.pages as DocumentPage[]) : [];
  const status = str(row.extraction_status ?? row.extractionStatus, "pending");
  return {
    ...syncFrom(row),
    folderId: strOrNull(row.folder_id ?? row.folderId),
    classId: strOrNull(row.class_id ?? row.classId),
    notebookId: strOrNull(row.notebook_id ?? row.notebookId),
    title: str(row.title, "Document"),
    fileName: str(row.file_name ?? row.fileName, "file"),
    mimeType: str(row.mime_type ?? row.mimeType, "application/octet-stream"),
    sizeBytes: num(row.size_bytes ?? row.sizeBytes),
    storagePath: strOrNull(row.storage_path ?? row.storagePath),
    kind: (str(row.kind, "unknown") as DocumentRecord["kind"]) || "unknown",
    extractedText: str(row.extracted_text ?? row.extractedText),
    pages,
    extractionStatus: status === "ready" || status === "error" || status === "needs_ocr" ? status : "pending",
    extractionError: strOrNull(row.extraction_error ?? row.extractionError),
    uploadStatus: uploadStatus(row.upload_status ?? row.uploadStatus),
    uploadError: strOrNull(row.upload_error ?? row.uploadError),
  };
}

export function recordingToRow(item: Recording) {
  return {
    ...syncTo(item),
    class_id: item.classId,
    notebook_id: item.notebookId,
    title: item.title,
    file_name: item.fileName,
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    duration_seconds: item.durationSeconds,
    storage_path: item.storagePath,
    upload_status: item.uploadStatus,
    upload_error: item.uploadError,
  };
}
export function recordingFromRow(row: Record<string, unknown>): Recording {
  return {
    ...syncFrom(row),
    classId: strOrNull(row.class_id ?? row.classId),
    notebookId: strOrNull(row.notebook_id ?? row.notebookId),
    title: str(row.title, "Recording"),
    fileName: str(row.file_name ?? row.fileName, "audio"),
    mimeType: str(row.mime_type ?? row.mimeType, "audio/webm"),
    sizeBytes: num(row.size_bytes ?? row.sizeBytes),
    durationSeconds: num(row.duration_seconds ?? row.durationSeconds),
    storagePath: strOrNull(row.storage_path ?? row.storagePath),
    uploadStatus: uploadStatus(row.upload_status ?? row.uploadStatus),
    uploadError: strOrNull(row.upload_error ?? row.uploadError),
  };
}

export function transcriptToRow(item: Transcript) {
  return { ...syncTo(item), recording_id: item.recordingId, content: item.content, segments: item.segments, source: item.source };
}
export function transcriptFromRow(row: Record<string, unknown>): Transcript {
  const source = str(row.source, "manual");
  return {
    ...syncFrom(row),
    recordingId: str(row.recording_id ?? row.recordingId),
    content: str(row.content),
    segments: Array.isArray(row.segments) ? (row.segments as TranscriptSegment[]) : [],
    source: source === "speech" || source === "import" ? source : "manual",
  };
}

export function drawingToRow(item: Drawing) {
  return { ...syncTo(item), notebook_id: item.notebookId, class_id: item.classId, title: item.title, pages: item.pages };
}
export function drawingFromRow(row: Record<string, unknown>): Drawing {
  return {
    ...syncFrom(row),
    notebookId: strOrNull(row.notebook_id ?? row.notebookId),
    classId: strOrNull(row.class_id ?? row.classId),
    title: str(row.title, "Drawing"),
    pages: Array.isArray(row.pages) ? (row.pages as DrawPage[]) : [],
  };
}

export function annotationToRow(item: PdfAnnotation) {
  return { ...syncTo(item), document_id: item.documentId, page_number: item.pageNumber, data: item.data };
}
export function annotationFromRow(row: Record<string, unknown>): PdfAnnotation {
  const data = row.data && typeof row.data === "object" ? (row.data as PdfAnnotationData) : emptyAnnotation();
  return {
    ...syncFrom(row),
    documentId: str(row.document_id ?? row.documentId),
    pageNumber: num(row.page_number ?? row.pageNumber, 1),
    data: {
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
      ink: Array.isArray(data.ink) ? data.ink : [],
      notes: Array.isArray(data.notes) ? data.notes : [],
    },
  };
}

export function favoriteToRow(item: Favorite) {
  return { ...syncTo(item), target_type: item.targetType, target_id: item.targetId };
}
export function favoriteFromRow(row: Record<string, unknown>): Favorite {
  return {
    ...syncFrom(row),
    targetType: str(row.target_type ?? row.targetType, "note") as Favorite["targetType"],
    targetId: str(row.target_id ?? row.targetId),
  };
}

export function toRow(entity: EntityName, item: unknown) {
  switch (entity) {
    case "classes":
      return classToRow(item as ClassItem);
    case "folders":
      return folderToRow(item as Folder);
    case "notebooks":
      return notebookToRow(item as import("@/lib/types").Notebook);
    case "sections":
      return sectionToRow(item as Section);
    case "notes":
      return noteToRow(item as Note);
    case "tags":
      return tagToRow(item as Tag);
    case "noteTags":
      return noteTagToRow(item as NoteTag);
    case "documents":
      return documentToRow(item as DocumentRecord);
    case "recordings":
      return recordingToRow(item as Recording);
    case "transcripts":
      return transcriptToRow(item as Transcript);
    case "drawings":
      return drawingToRow(item as Drawing);
    case "annotations":
      return annotationToRow(item as PdfAnnotation);
    case "favorites":
      return favoriteToRow(item as Favorite);
  }
}

export function fromRow(entity: EntityName, row: Record<string, unknown>) {
  switch (entity) {
    case "classes":
      return classFromRow(row);
    case "folders":
      return folderFromRow(row);
    case "notebooks":
      return notebookFromRow(row);
    case "sections":
      return sectionFromRow(row);
    case "notes":
      return noteFromRow(row);
    case "tags":
      return tagFromRow(row);
    case "noteTags":
      return noteTagFromRow(row);
    case "documents":
      return documentFromRow(row);
    case "recordings":
      return recordingFromRow(row);
    case "transcripts":
      return transcriptFromRow(row);
    case "drawings":
      return drawingFromRow(row);
    case "annotations":
      return annotationFromRow(row);
    case "favorites":
      return favoriteFromRow(row);
  }
}

export function entityId(item: unknown) {
  return str((item as SyncFields).id);
}

export function withUser(item: SyncFields, userId: string): SyncFields {
  return { ...item, userId };
}

export function withBase(item: SyncFields, baseUpdatedAt: string | null): SyncFields {
  return { ...item, baseUpdatedAt };
}

export type OutboxItem = {
  id: string;
  entity: EntityName;
  entityId: string;
  op: "upsert" | "delete";
  updatedAt: string;
  attempts: number;
  lastError: string | null;
};

export function outboxKey(entity: EntityName, entityId: string) {
  return `${entity}:${entityId}`;
}

export type BlobRecord = {
  id: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
};

export type MetaRecord = { id: string; value: string };

export function isConflict(value: unknown): value is ConflictRecord {
  return Boolean(value && typeof value === "object" && "entityType" in value && "entityId" in value);
}
