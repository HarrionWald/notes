export type SaveStatus = "saved" | "saving" | "offline" | "pending" | "error" | "conflict";

export type ThemePreference = "light" | "dark" | "system";

export type Preferences = {
  theme: ThemePreference;
  autosaveMs: number;
  autoSync: boolean;
  uploadLimitBytes: number;
  keepLocalMedia: boolean;
  stylusOnly: boolean;
};

export type SyncFields = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  baseUpdatedAt: string | null;
  deletedAt: string | null;
};

export type ClassItem = SyncFields & {
  name: string;
  subject: string;
  color: string;
  description: string;
};

export type Folder = SyncFields & {
  parentId: string | null;
  name: string;
};

export type Notebook = SyncFields & {
  classId: string | null;
  folderId: string | null;
  title: string;
  description: string;
  color: string;
};

export type Section = SyncFields & {
  notebookId: string;
  parentId: string | null;
  title: string;
  position: number;
};

export type NoteNode = {
  type?: string;
  text?: string;
  content?: NoteNode[];
  marks?: { type: string; attrs?: Record<string, string> }[];
  attrs?: Record<string, unknown>;
};

export type NoteContent = {
  type: "doc";
  content?: NoteNode[];
};

export type Note = SyncFields & {
  notebookId: string | null;
  sectionId: string | null;
  classId: string | null;
  folderId: string | null;
  title: string;
  content: NoteContent;
  contentText: string;
  wordCount: number;
  templateType: string | null;
  sourceDocumentId: string | null;
};

export type Tag = SyncFields & {
  name: string;
  color: string;
};

export type NoteTag = SyncFields & {
  noteId: string;
  tagId: string;
};

export type DocumentKind = "pdf" | "docx" | "pptx" | "text" | "image" | "audio" | "video" | "unknown";

export type ExtractionMethod = "text" | "ocr" | "manual" | "none";

export type DocumentPage = {
  number: number;
  label: string;
  text: string;
  method: ExtractionMethod;
};

export type UploadStatus = "pending" | "uploading" | "uploaded" | "error" | "local";

export type DocumentRecord = SyncFields & {
  folderId: string | null;
  classId: string | null;
  notebookId: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string | null;
  kind: DocumentKind;
  extractedText: string;
  pages: DocumentPage[];
  extractionStatus: "pending" | "ready" | "error" | "needs_ocr";
  extractionError: string | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
};

export type Recording = SyncFields & {
  classId: string | null;
  notebookId: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  storagePath: string | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
};

export type TranscriptSegment = {
  text: string;
  startMs: number | null;
  approximate: boolean;
};

export type Transcript = SyncFields & {
  recordingId: string;
  content: string;
  segments: TranscriptSegment[];
  source: "speech" | "manual" | "import";
};

export type Drawing = SyncFields & {
  notebookId: string | null;
  classId: string | null;
  title: string;
  pages: DrawPage[];
};

export type PaperStyle = "blank" | "lined" | "dotted" | "grid";

export type DrawPoint = { x: number; y: number; p: number };

export type DrawTool = "pen" | "highlighter" | "eraser" | "select" | "text" | "line" | "arrow" | "rect" | "ellipse" | "pan";

export type Stroke = {
  id: string;
  tool: "pen" | "highlighter" | "line" | "arrow" | "rect" | "ellipse";
  color: string;
  width: number;
  points: DrawPoint[];
};

export type DrawText = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
};

export type DrawImage = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
};

export type DrawPage = {
  id: string;
  paper: PaperStyle;
  strokes: Stroke[];
  texts: DrawText[];
  images: DrawImage[];
};

export type PdfRect = { x: number; y: number; w: number; h: number };

export type PdfAnnotationData = {
  highlights: { id: string; color: string; rects: PdfRect[]; text: string }[];
  ink: Stroke[];
  notes: { id: string; x: number; y: number; text: string; color: string }[];
};

export type PdfAnnotation = SyncFields & {
  documentId: string;
  pageNumber: number;
  data: PdfAnnotationData;
};

export type FavoriteTarget = "note" | "notebook" | "document" | "recording" | "drawing" | "class";

export type Favorite = SyncFields & {
  targetType: FavoriteTarget;
  targetId: string;
};

export type ConflictRecord = {
  id: string;
  entityType: string;
  entityId: string;
  local: unknown;
  remote: unknown;
  createdAt: string;
};

export type Snapshot = {
  classes: ClassItem[];
  folders: Folder[];
  notebooks: Notebook[];
  sections: Section[];
  notes: Note[];
  tags: Tag[];
  noteTags: NoteTag[];
  documents: DocumentRecord[];
  recordings: Recording[];
  transcripts: Transcript[];
  drawings: Drawing[];
  annotations: PdfAnnotation[];
  favorites: Favorite[];
  conflicts: ConflictRecord[];
};
