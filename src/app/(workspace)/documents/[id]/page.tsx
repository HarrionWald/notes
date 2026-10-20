"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PdfReader } from "@/components/pdf-reader";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { extractFile, parsePageRange } from "@/lib/documents/extract";
import { markdownToDoc } from "@/lib/notes/text";
import { STUDY_TEMPLATES, applyStudyTemplate, type StudyTemplateId } from "@/lib/notes/templates";
import type { PdfAnnotation } from "@/lib/types";
import { createId } from "@/lib/utils";

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const workspace = useWorkspace();
  const router = useRouter();
  const document = workspace.snapshot.documents.find((item) => item.id === params.id);
  const [preview, setPreview] = useState("");
  const [template, setTemplate] = useState<StudyTemplateId>("structured");
  const [range, setRange] = useState("1-3");
  const [progress, setProgress] = useState<string | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const annotations = workspace.snapshot.annotations.filter((item) => item.documentId === params.id && !item.deletedAt);

  useEffect(() => {
    if (!document) return;
    let ignore = false;
    void workspace.fileUrl(document.id, document.storagePath).then(async (url) => {
      if (ignore || !url) return;
      setMediaUrl(url);
      if (document.kind === "pdf" || document.kind === "image") {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        if (!ignore) setBytes(buffer);
      }
    });
    return () => {
      ignore = true;
    };
  }, [document, workspace]);

  if (!document || document.deletedAt) return <p className="p-6 text-sm">That document is not on this device.</p>;

  async function runOcr() {
    if (!document) return;
    const blob = await workspace.fileUrl(document.id, document.storagePath);
    if (!blob) {
      setProgress("The original file is not on this device, so OCR cannot run offline.");
      return;
    }
    const response = await fetch(blob);
    const data = await response.arrayBuffer();
    const pages = parsePageRange(range, Math.max(document.pages.length, 1));
    if (pages.length > 5 && !window.confirm("OCR runs locally and can be slow. Process these pages?")) return;
    setProgress("Starting local OCR…");
    const extracted = await extractFile({
      kind: document.kind,
      fileName: document.fileName,
      data,
      ocrPages: document.kind === "image" ? [1] : pages,
      onProgress: setProgress,
    });
    await workspace.saveDocument({
      ...document,
      extractedText: extracted.text,
      pages: extracted.pages.length ? extracted.pages : document.pages,
      extractionStatus: extracted.status,
      extractionError: extracted.error,
    });
    setProgress(extracted.error);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <input className="w-full bg-transparent text-3xl font-semibold outline-none" value={document.title} aria-label="Document title" onChange={(event) => void workspace.saveDocument({ ...document, title: event.target.value })} />
      <p className="mt-2 text-sm text-muted-foreground">{document.fileName} · {document.kind} · {document.extractionStatus} · {document.uploadStatus}</p>
      {document.extractionError ? <p className="mt-2 text-sm text-destructive">{document.extractionError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="text-sm">Class
          <select className="ml-2 h-9 rounded-lg border border-input bg-card px-2" value={document.classId ?? ""} onChange={(event) => void workspace.saveDocument({ ...document, classId: event.target.value || null })}>
            <option value="">None</option>
            {workspace.snapshot.classes.filter((item) => !item.deletedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <Button variant="destructive" onClick={() => void workspace.softDelete("documents", document).then(() => router.push("/documents"))}>Move to trash</Button>
      </div>
      {(document.kind === "image" || document.extractionStatus === "needs_ocr") && (
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="text-sm">OCR uses Tesseract in your browser. For a long PDF, enter a small page range such as 1-3.</p>
          <div className="mt-2 flex gap-2">
            <Input value={range} onChange={(event) => setRange(event.target.value)} aria-label="Pages to recognize" />
            <Button onClick={() => void runOcr()}>Run local OCR</Button>
          </div>
          {progress ? <p className="mt-2 text-sm">{progress}</p> : null}
        </div>
      )}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Study note template</h2>
        <p className="text-sm text-muted-foreground">Templates only rearrange text that was already extracted. They do not add facts.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select className="h-10 rounded-lg border border-input bg-card px-2" value={template} onChange={(event) => setTemplate(event.target.value as StudyTemplateId)} aria-label="Template">
            {STUDY_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Button
            variant="outline"
            onClick={() => setPreview(applyStudyTemplate(template, { title: document.title, fileName: document.fileName, pages: document.pages }))}
          >
            Preview
          </Button>
          <Button
            onClick={() => {
              const markdown = applyStudyTemplate(template, { title: document.title, fileName: document.fileName, pages: document.pages });
              const content = markdownToDoc(markdown);
              void workspace.createNote({
                title: `${document.title} — ${STUDY_TEMPLATES.find((item) => item.id === template)?.name ?? "Notes"}`,
                content,
                contentText: markdown,
                templateType: template,
                sourceDocumentId: document.id,
                classId: document.classId,
                notebookId: document.notebookId,
              }).then((note) => router.push(`/notes/${note.id}`));
            }}
          >
            Create editable note
          </Button>
        </div>
        {preview ? <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-card p-4 text-sm">{preview}</pre> : null}
      </section>
      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">Extracted text</h2>
        {document.pages.map((page) => (
          <article key={`${page.label}-${page.number}`} className="rounded-xl border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{page.label} · {page.method === "ocr" ? "OCR text" : page.method === "text" ? "Selectable text" : "No text extracted"}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{page.text || "Nothing was extracted from this page."}</p>
          </article>
        ))}
      </section>
      {document.kind === "pdf" && bytes ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">PDF and annotations</h2>
          <PdfReader
            data={bytes}
            annotations={annotations}
            onAnnotation={(data, pageNumber) => {
              const existing = annotations.find((item) => item.pageNumber === pageNumber);
              const next: PdfAnnotation = existing ?? {
                id: createId(),
                userId: document.userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                baseUpdatedAt: null,
                deletedAt: null,
                documentId: document.id,
                pageNumber,
                data,
              };
              void workspace.saveAnnotation({ ...next, data, pageNumber });
            }}
            onCreateNote={(text, pageNumber) => {
              const content = markdownToDoc(`# ${document.title}\n\nSource page ${pageNumber}\n\n${text}`);
              void workspace.createNote({ title: `${document.title} p. ${pageNumber}`, content, contentText: text, sourceDocumentId: document.id, classId: document.classId }).then((note) => router.push(`/notes/${note.id}`));
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">Annotations are saved separately. The original PDF is not modified.</p>
        </section>
      ) : null}
      {mediaUrl && document.kind === "video" ? <video className="mt-6 w-full rounded-xl" controls src={mediaUrl} /> : null}
      {mediaUrl && document.kind === "image" ? (
        // User-imported lecture images are shown from a local or signed URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mt-6 max-w-full rounded-xl border border-border" src={mediaUrl} alt={document.title} />
      ) : null}
    </div>
  );
}
