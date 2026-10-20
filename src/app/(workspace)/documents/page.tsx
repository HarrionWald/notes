"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { prepareUpload } from "@/components/workspace-provider";
import { Button, ConfirmDialog, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { extractFile } from "@/lib/documents/extract";
import { shouldWarnBeforeUpload } from "@/lib/limits";
import { safeFileName } from "@/lib/files/validate";
import type { DocumentRecord } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

export default function DocumentsPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [folderName, setFolderName] = useState("");
  const documents = workspace.snapshot.documents.filter((item) => !item.deletedAt);
  const folders = workspace.snapshot.folders.filter((item) => !item.deletedAt);

  async function importFile(file: File) {
    const check = await prepareUpload(file, workspace.preferences.uploadLimitBytes);
    if (!check.ok) {
      setMessage(check.error);
      return;
    }
    if (check.kind === "audio") {
      setMessage("Audio files open in Recordings so you can keep a transcript with them.");
      router.push("/recordings");
      return;
    }
    setMessage(null);
    setProgress("Reading the file on this device…");
    const bytes = await file.arrayBuffer();
    const extracted = await extractFile({ kind: check.kind, fileName: file.name, data: bytes, onProgress: setProgress });
    const record = workspace.stamp({
      title: file.name.replace(/\.[^.]+$/, ""),
      fileName: safeFileName(file.name),
      mimeType: check.mimeType,
      sizeBytes: file.size,
      storagePath: null,
      folderId: null,
      classId: null,
      notebookId: null,
      kind: check.kind,
      extractedText: extracted.text,
      pages: extracted.pages,
      extractionStatus: extracted.status,
      extractionError: extracted.error,
      uploadStatus: workspace.configured ? "pending" : "local",
      uploadError: null,
    }) as DocumentRecord;
    await workspace.storeBlob(record.id, file, record.fileName, record.mimeType);
    const status = await workspace.saveDocument(record);
    setProgress(null);
    if (status === "pending" || status === "offline") setMessage("The file and extracted text are saved on this device. Upload will wait until you are online.");
    router.push(`/documents/${record.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        PDF, DOCX, PPTX, text, images, and video stay on your device while text is extracted. OCR runs locally. Document text is not sent to an AI service.
      </p>
      <label className="mt-4 block text-sm">
        Import a file
        <input
          className="mt-1 block"
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,audio/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (shouldWarnBeforeUpload(file.size, workspace.preferences.uploadLimitBytes)) setPendingFile(file);
            else void importFile(file);
          }}
        />
      </label>
      {progress ? <p className="mt-3 text-sm">{progress}</p> : null}
      {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!folderName.trim()) return;
          void workspace.createFolder(folderName.trim());
          setFolderName("");
        }}
      >
        <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="New folder" aria-label="Folder name" />
        <Button type="submit" variant="outline">Add folder</Button>
      </form>
      {folders.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {folders.map((folder) => <li key={folder.id} className="rounded-full bg-accent px-3 py-1 text-sm">{folder.name}</li>)}
        </ul>
      ) : null}
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {documents.map((document) => (
          <li key={document.id}>
            <Link href={`/documents/${document.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
              <span>
                <span className="block font-medium">{document.title}</span>
                <span className="text-xs text-muted-foreground">{document.kind} · {document.extractionStatus} · {document.uploadStatus}</span>
              </span>
              <span className="text-xs text-muted-foreground">{formatBytes(document.sizeBytes)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {documents.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Import a lecture file to extract its text.</p> : null}
      <ConfirmDialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => { if (!open) setPendingFile(null); }}
        title="This file is large"
        description={pendingFile ? `${pendingFile.name} is ${formatBytes(pendingFile.size)}. Free Supabase storage is limited, and a copy stays on this device until upload finishes. Continue?` : ""}
        confirmLabel="Import anyway"
        onConfirm={() => {
          const file = pendingFile;
          setPendingFile(null);
          if (file) void importFile(file);
        }}
      />
    </div>
  );
}
