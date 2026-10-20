import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBackup, createBackup, mergeByUpdatedAt } from "@/lib/data/backup";
import { noteFromRow, noteToRow } from "@/lib/data/rows";
import { parsePageRange } from "@/lib/documents/extract";
import { extractTextFromSlideXml, slideNumberFromPath } from "@/lib/documents/pptx";
import { hitTestStroke, moveStroke, eraseStrokes, blankPage, drawingByteSize } from "@/lib/drawings/model";
import { validateFile } from "@/lib/files/validate";
import { NAV_ITEMS, layoutMode } from "@/lib/layout";
import { clampUploadLimit, estimateUsage, shouldWarnBeforeUpload, storageWarning, SUPABASE_FREE_STORAGE_BYTES } from "@/lib/limits";
import { applyStudyTemplate, generateReviewQuestions, parseFlashcards, structuredLectureNotes } from "@/lib/notes/templates";
import { countWords, docToMarkdown, emptyDoc, markdownToDoc } from "@/lib/notes/text";
import { addHighlight, denormalizeRect, emptyAnnotation, normalizeRect } from "@/lib/pdf/annotations";
import { nextSaveStatus, saveStatusLabel } from "@/lib/save-status";
import { searchItems } from "@/lib/search/search";
import { decideSync, sortByParent } from "@/lib/sync/conflicts";
import { explainSyncError, recordingErrorMessage, speechUnavailableMessage } from "@/lib/sync/errors";
import { seekTimeForSegment, segmentFromResult, speechSupport } from "@/lib/transcripts/speech";
import type { Note, Snapshot } from "@/lib/types";

const OWNED_TABLES = [
  "classes",
  "folders",
  "notebooks",
  "sections",
  "notes",
  "tags",
  "note_tags",
  "documents",
  "recordings",
  "transcripts",
  "drawings",
  "pdf_annotations",
  "favorites",
  "sync_metadata",
];

describe("authorization rules", () => {
  const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");

  it("enables row level security for every user-owned table", () => {
    expect(sql).toContain("alter table public.profiles enable row level security");
    expect(sql).toContain("auth.uid() = id");
    for (const table of OWNED_TABLES) {
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("storage.foldername(name)");
    expect(sql).not.toContain("service_role");
  });

  it("keeps the service role key out of client source", () => {
    const client = readFileSync("src/lib/supabase/client.ts", "utf8");
    const env = readFileSync("src/lib/supabase/env.ts", "utf8");
    expect(client).not.toContain("SERVICE_ROLE");
    expect(env).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(env).not.toContain("SERVICE_ROLE");
  });
});

describe("sync decisions", () => {
  const base = "2026-10-19T12:00:00.000Z";
  const local = "2026-10-19T12:05:00.000Z";
  const remote = "2026-10-19T12:04:00.000Z";

  it("inserts local records the server has never seen", () => {
    expect(decideSync({ localUpdatedAt: local, baseUpdatedAt: null, remoteUpdatedAt: null })).toBe("insert");
  });

  it("pulls remote records that are new on this device", () => {
    expect(decideSync({ localUpdatedAt: null, baseUpdatedAt: null, remoteUpdatedAt: remote })).toBe("pull");
  });

  it("updates when only this device changed", () => {
    expect(decideSync({ localUpdatedAt: local, baseUpdatedAt: base, remoteUpdatedAt: base })).toBe("update");
  });

  it("pulls when only another device changed", () => {
    expect(decideSync({ localUpdatedAt: base, baseUpdatedAt: base, remoteUpdatedAt: remote })).toBe("pull");
  });

  it("conflicts when both sides changed and does not pick a winner", () => {
    expect(decideSync({ localUpdatedAt: local, baseUpdatedAt: base, remoteUpdatedAt: remote })).toBe("conflict");
  });

  it("treats equivalent timestamps as already synced", () => {
    expect(decideSync({ localUpdatedAt: "2026-10-19T12:00:00.000Z", baseUpdatedAt: base, remoteUpdatedAt: "2026-10-19T12:00:00+00:00" })).toBe("noop");
  });

  it("sorts parents before children", () => {
    const sorted = sortByParent([
      { id: "child", parentId: "parent" },
      { id: "parent", parentId: null },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["parent", "child"]);
  });
});

describe("save status", () => {
  it("does not report saved before local persistence", () => {
    expect(nextSaveStatus({ type: "edit" })).toBe("saving");
    expect(nextSaveStatus({ type: "local-failed" })).toBe("error");
  });

  it("reports a local save as waiting when cloud sync has not finished", () => {
    expect(nextSaveStatus({ type: "local-saved", online: false, cloud: true })).toBe("offline");
    expect(nextSaveStatus({ type: "remote-failed" })).toBe("pending");
    expect(saveStatusLabel("pending", true)).toMatch(/waiting to synchronize/);
  });

  it("reports saved only after the chosen store confirms it", () => {
    expect(nextSaveStatus({ type: "remote-saved" })).toBe("saved");
    expect(nextSaveStatus({ type: "local-saved", online: true, cloud: false })).toBe("saved");
    expect(saveStatusLabel("saved", false)).toMatch(/this device/);
  });
});

describe("files", () => {
  it("accepts a lecture PDF inside the limit", () => {
    const result = validateFile({ name: "lecture.pdf", size: 1200, type: "application/pdf", limitBytes: 1024 * 1024 });
    expect(result).toEqual({ ok: true, kind: "pdf", mimeType: "application/pdf" });
  });

  it("rejects unsupported types and oversized files", () => {
    expect(validateFile({ name: "virus.exe", size: 100, type: "application/octet-stream", limitBytes: 1024 * 1024 }).ok).toBe(false);
    expect(validateFile({ name: "big.pdf", size: 60 * 1024 * 1024, type: "application/pdf", limitBytes: 50 * 1024 * 1024 }).ok).toBe(false);
    expect(validateFile({ name: "notes.docx", size: 10, type: "application/pdf", limitBytes: 1024 * 1024 }).ok).toBe(false);
  });

  it("parses OCR page ranges", () => {
    expect(parsePageRange("1, 3-4, 9", 5)).toEqual([1, 3, 4]);
  });
});

describe("documents and templates", () => {
  const source = {
    title: "Cells",
    fileName: "cells.pptx",
    pages: [
      { number: 1, label: "Slide 1", method: "text" as const, text: "Mitosis is the division of a cell nucleus.\n\nDNA replication copies the genome." },
    ],
  };

  it("extracts PPTX slide text without inventing words", () => {
    const xml = `<p:sld><a:t>Mitosis</a:t><a:t>is &amp; copies</a:t></p:sld>`;
    expect(extractTextFromSlideXml(xml)).toBe("Mitosis is & copies");
    expect(slideNumberFromPath("ppt/slides/slide12.xml")).toBe(12);
  });

  it("keeps structured notes inside the source text", () => {
    const markdown = structuredLectureNotes(source);
    expect(markdown).toContain("Mitosis is the division of a cell nucleus.");
    expect(markdown).toContain("DNA replication copies the genome.");
    expect(markdown).toContain("not generated by AI");
    expect(markdown.toLowerCase()).not.toContain("mitochondria");
  });

  it("builds every template from the same source", () => {
    for (const id of ["structured", "cornell", "outline", "study-guide", "flashcards", "reading"] as const) {
      const markdown = applyStudyTemplate(id, source);
      expect(markdown).toContain("Mitosis is the division of a cell nucleus.");
    }
  });

  it("creates editable review questions with a visible rule", () => {
    const questions = generateReviewQuestions("Mitosis is the division of a cell nucleus.");
    expect(questions[0]).toMatchObject({ question: "What is Mitosis?", rule: "definition-is" });
    expect(questions[0]?.answer).toContain("division of a cell nucleus");
    const cards = parseFlashcards("Q: What is Mitosis?\nA: Division of the nucleus\n");
    expect(cards).toEqual([{ question: "What is Mitosis?", answer: "Division of the nucleus" }]);
  });
});

describe("notes", () => {
  it("counts words and round-trips headings to markdown", () => {
    expect(countWords("one two  three")).toBe(3);
    const doc = markdownToDoc("# Title\n\n- Alpha\n- Beta\n\n**Bold** idea");
    const markdown = docToMarkdown(doc);
    expect(markdown).toContain("# Title");
    expect(markdown).toContain("Alpha");
    expect(markdown).toContain("**Bold**");
    const note: Note = {
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user",
      createdAt: "2026-10-19T12:00:00.000Z",
      updatedAt: "2026-10-19T12:00:00.000Z",
      baseUpdatedAt: null,
      deletedAt: null,
      notebookId: null,
      sectionId: null,
      classId: null,
      folderId: null,
      title: "Title",
      content: emptyDoc(),
      contentText: "hello",
      wordCount: 1,
      templateType: null,
      sourceDocumentId: null,
    };
    expect(noteFromRow(noteToRow(note) as Record<string, unknown>).title).toBe("Title");
  });
});

describe("search, layout, and storage", () => {
  const items = [
    {
      id: "1",
      kind: "note" as const,
      title: "Biology lecture",
      text: "mitosis notes",
      classId: "bio",
      notebookId: "nb",
      tagIds: ["tag"],
      updatedAt: "2026-10-19T12:00:00.000Z",
      createdAt: "2026-10-18T12:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "2",
      kind: "document" as const,
      title: "Old handout",
      text: "history",
      classId: "hist",
      notebookId: null,
      tagIds: [],
      updatedAt: "2026-10-17T12:00:00.000Z",
      createdAt: "2026-10-17T12:00:00.000Z",
      deletedAt: "2026-10-18T12:00:00.000Z",
      documentKind: "pdf",
    },
  ];

  it("filters by query, class, and tag", () => {
    expect(searchItems(items, { query: "mitosis", classId: "bio", tagId: "tag" })).toHaveLength(1);
    expect(searchItems(items, { includeDeleted: true })).toHaveLength(1);
  });

  it("uses a single column below the desktop breakpoint", () => {
    expect(layoutMode(390)).toBe("mobile");
    expect(layoutMode(800)).toBe("tablet");
    expect(layoutMode(1280)).toBe("desktop");
    expect(NAV_ITEMS).toHaveLength(10);
  });

  it("warns before large uploads and when storage is nearly full", () => {
    expect(shouldWarnBeforeUpload(11 * 1024 * 1024, 25 * 1024 * 1024)).toBe(true);
    expect(clampUploadLimit(999 * 1024 * 1024)).toBe(50 * 1024 * 1024);
    const usage = estimateUsage({
      documents: [{ sizeBytes: SUPABASE_FREE_STORAGE_BYTES, deletedAt: null, extractedText: "" }],
      recordings: [],
      notes: [{ contentText: "abc", deletedAt: null }],
      drawings: [],
    });
    expect(storageWarning(usage.files, SUPABASE_FREE_STORAGE_BYTES)).toMatch(/free storage allowance/);
  });
});

describe("recordings and transcription", () => {
  it("explains microphone permission failures", () => {
    expect(recordingErrorMessage({ name: "NotAllowedError" })).toMatch(/permission was denied/i);
    expect(recordingErrorMessage({ name: "NotFoundError" })).toMatch(/No microphone/);
  });

  it("explains when speech recognition is unavailable", () => {
    expect(speechSupport(undefined).supported).toBe(false);
    expect(speechUnavailableMessage()).toMatch(/type a transcript/i);
    const segment = segmentFromResult("hello class", 1500);
    expect(segment.approximate).toBe(true);
    expect(seekTimeForSegment(segment.startMs)).toBe(1.5);
  });

  it("explains quota failures without discarding the message", () => {
    expect(explainSyncError("quota exceeded")).toMatch(/still saved on this device/);
    expect(explainSyncError("new row violates row-level security")).toMatch(/Sign in again/);
  });
});

describe("drawings and PDF annotations", () => {
  it("saves and restores stroke geometry", () => {
    const page = blankPage("page");
    const stroke = { id: "s", tool: "pen" as const, color: "#111", width: 4, points: [{ x: 10, y: 10, p: 0.5 }, { x: 20, y: 12, p: 0.8 }] };
    page.strokes.push(stroke);
    const restored = structuredClone(page);
    expect(hitTestStroke(restored.strokes, { x: 15, y: 11, p: 1 })?.id).toBe("s");
    expect(moveStroke(stroke, 5, 0).points[0]?.x).toBe(15);
    expect(eraseStrokes(restored.strokes, { x: 15, y: 11, p: 1 }, 8)).toHaveLength(0);
    expect(drawingByteSize([restored])).toBeGreaterThan(10);
  });

  it("stores annotation geometry separately from the PDF bytes", () => {
    const normalized = normalizeRect({ x: 10, y: 20, w: 30, h: 40 }, 100, 200);
    const back = denormalizeRect(normalized, 100, 200);
    expect(back).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    const next = addHighlight(emptyAnnotation(), { id: "h", color: "#fde68a", rects: [normalized], text: "cell" });
    expect(next.highlights).toHaveLength(1);
    expect(next.ink).toEqual([]);
  });
});

describe("backup import", () => {
  it("rejects unknown files and keeps the newer copy", () => {
    expect(parseBackup({ hello: true }).ok).toBe(false);
    const current = [{ id: "a", updatedAt: "2026-10-19T12:00:00.000Z", title: "local" }];
    const incoming = [{ id: "a", updatedAt: "2026-10-18T12:00:00.000Z", title: "old" }, { id: "b", updatedAt: "2026-10-19T12:00:00.000Z", title: "new" }];
    const merged = mergeByUpdatedAt(current, incoming);
    expect(merged.find((item) => item.id === "a")?.title).toBe("local");
    expect(merged.find((item) => item.id === "b")?.title).toBe("new");
  });

  it("round-trips an empty snapshot", () => {
    const snapshot = {
      classes: [],
      folders: [],
      notebooks: [],
      sections: [],
      notes: [],
      tags: [],
      noteTags: [],
      documents: [],
      recordings: [],
      transcripts: [],
      drawings: [],
      annotations: [],
      favorites: [],
      conflicts: [],
    } satisfies Snapshot;
    const parsed = parseBackup(createBackup(snapshot, "2026-10-19T12:00:00.000Z"));
    expect(parsed.ok).toBe(true);
  });
});
