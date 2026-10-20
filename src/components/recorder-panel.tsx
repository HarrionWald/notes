"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { recordingErrorMessage, speechUnavailableMessage } from "@/lib/sync/errors";
import { seekTimeForSegment, segmentFromResult, speechSupport } from "@/lib/transcripts/speech";
import type { Recording, Transcript, TranscriptSegment } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

type SpeechResult = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };

export function RecorderPanel({ recording, transcript }: { recording: Recording | null; transcript: Transcript | null }) {
  const workspace = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState(recording?.title ?? "Lecture recording");
  const [classId, setClassId] = useState(recording?.classId ?? "");
  const [notebookId, setNotebookId] = useState(recording?.notebookId ?? "");
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");
  const [elapsed, setElapsed] = useState(recording?.durationSeconds ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>(transcript?.segments ?? []);
  const [content, setContent] = useState(transcript?.content ?? "");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const accumulated = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!recording) return;
    let ignore = false;
    void workspace.fileUrl(recording.id, recording.storagePath).then((url) => {
      if (!ignore) setAudioUrl(url);
    });
    return () => {
      ignore = true;
    };
  }, [recording, workspace]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => setElapsed(accumulated.current + (performance.now() - started.current) / 1000), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio. You can still import an audio file.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        void saveRecording(blob);
      };
      recorderRef.current = recorder;
      accumulated.current = 0;
      started.current = performance.now();
      recorder.start();
      setStatus("recording");
      startSpeech();
    } catch (caught) {
      setError(recordingErrorMessage(caught instanceof DOMException ? caught : { message: "Recording could not start." }));
    }
  }

  function startSpeech() {
    const SpeechApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const support = speechSupport(SpeechApi);
    if (!support.supported || !SpeechApi) {
      setSpeechNote(speechUnavailableMessage());
      return;
    }
    try {
      const recognition = new SpeechApi();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: SpeechResult) => {
        let finalText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result?.isFinal) finalText += result[0]?.transcript ?? "";
        }
        if (!finalText.trim()) return;
        const segment = segmentFromResult(finalText, performance.now() - started.current + accumulated.current * 1000);
        setSegments((current) => [...current, segment]);
        setContent((current) => `${current} ${finalText}`.trim());
      };
      recognition.onerror = () => setSpeechNote("Speech recognition stopped. The recording continues, and you can type the transcript.");
      recognition.onend = () => {
        if (recorderRef.current?.state === "recording") {
          try {
            recognition.start();
          } catch {
            setSpeechNote("Continuous recognition is not available in this browser. Type or import the transcript.");
          }
        }
      };
      recognition.start();
      recognitionRef.current = recognition;
      setSpeechNote("Transcription is approximate and depends on this browser. It may send audio to the browser’s speech service. Recording still works if recognition stops.");
    } catch {
      setSpeechNote(speechUnavailableMessage());
    }
  }

  function pause() {
    if (recorderRef.current?.state === "recording" && typeof recorderRef.current.pause === "function") {
      accumulated.current += (performance.now() - started.current) / 1000;
      recorderRef.current.pause();
      setStatus("paused");
    }
  }

  function resume() {
    if (recorderRef.current?.state === "paused" && typeof recorderRef.current.resume === "function") {
      started.current = performance.now();
      recorderRef.current.resume();
      setStatus("recording");
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    recorderRef.current?.stop();
    setStatus("idle");
  }

  async function saveRecording(blob: Blob) {
    const saved = workspace.stamp({
      ...(recording ?? {}),
      title: title || "Lecture recording",
      classId: classId || null,
      notebookId: notebookId || null,
      fileName: `recording.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
      mimeType: blob.type || "audio/webm",
      sizeBytes: blob.size,
      durationSeconds: elapsed,
      storagePath: recording?.storagePath ?? null,
      uploadStatus: workspace.configured ? "pending" : "local",
      uploadError: null,
    }) as Recording;
    if (recording) {
      saved.id = recording.id;
      saved.createdAt = recording.createdAt;
      saved.baseUpdatedAt = recording.baseUpdatedAt;
    }
    await workspace.storeBlob(saved.id, blob, saved.fileName, saved.mimeType);
    setProgress(0);
    const result = await workspace.saveRecording(saved);
    setProgress(workspace.uploadProgress[saved.id] ?? (result === "saved" ? 1 : null));
    const nextTranscript = workspace.stamp({
      recordingId: saved.id,
      content,
      segments,
      source: segments.length ? "speech" : "manual",
    }) as Transcript;
    if (transcript) {
      nextTranscript.id = transcript.id;
      nextTranscript.createdAt = transcript.createdAt;
    }
    await workspace.saveTranscript(nextTranscript);
    setAudioUrl(URL.createObjectURL(blob));
    if (result === "pending" || result === "offline") setError("The recording is saved on this device and waiting to upload. It will not upload again automatically after a failure until you retry sync.");
    if (!recording) router.push(`/recordings/${saved.id}`);
  }

  async function importAudio(file: File) {
    const check = await import("@/components/workspace-provider").then((mod) => mod.prepareUpload(file, workspace.preferences.uploadLimitBytes));
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if (check.kind !== "audio" && check.kind !== "video") {
      setError("Choose an audio file for a recording. Video files belong in Documents.");
      return;
    }
    await saveRecording(file);
  }

  async function saveTranscriptText(source: Transcript["source"]) {
    if (!recording) return;
    const next = workspace.stamp({ recordingId: recording.id, content, segments, source }) as Transcript;
    if (transcript) {
      next.id = transcript.id;
      next.createdAt = transcript.createdAt;
    }
    await workspace.saveTranscript(next);
  }

  const canPause = typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Recording</h2>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Recording title" />
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="h-10 rounded-lg border border-input bg-card px-2" value={classId} onChange={(event) => setClassId(event.target.value)} aria-label="Class">
            <option value="">No class</option>
            {workspace.snapshot.classes.filter((item) => !item.deletedAt).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select className="h-10 rounded-lg border border-input bg-card px-2" value={notebookId} onChange={(event) => setNotebookId(event.target.value)} aria-label="Notebook">
            <option value="">No notebook</option>
            {workspace.snapshot.notebooks.filter((item) => !item.deletedAt).map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </div>
        <p className="font-mono text-2xl" aria-live="polite">{formatDuration(elapsed)}</p>
        <div className="flex flex-wrap gap-2">
          {status === "idle" ? <Button onClick={() => void start()}>Start</Button> : null}
          {status === "recording" && canPause ? <Button variant="outline" onClick={pause}>Pause</Button> : null}
          {status === "paused" ? <Button variant="outline" onClick={resume}>Resume</Button> : null}
          {status !== "idle" ? <Button variant="destructive" onClick={stop}>Stop and save</Button> : null}
        </div>
        <label className="block text-sm">
          Import audio
          <input className="mt-1 block text-sm" type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importAudio(file); }} />
        </label>
        {audioUrl ? <audio ref={audioRef} controls src={audioUrl} className="w-full" /> : <p className="text-sm text-muted-foreground">No audio loaded yet.</p>}
        {recording ? (
          <p className="text-xs text-muted-foreground">
            {formatBytesSafe(recording.sizeBytes)} · {recording.uploadStatus}
            {recording.uploadError ? ` · ${recording.uploadError}` : ""}
            {progress !== null ? ` · upload ${Math.round(progress * 100)}%` : ""}
          </p>
        ) : null}
        {recording ? (
          <Button variant="destructive" onClick={() => void workspace.permanentDelete("recordings", recording).then(() => router.push("/recordings"))}>
            Delete recording and audio
          </Button>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Transcript</h2>
        {speechNote ? <p className="text-sm text-muted-foreground">{speechNote}</p> : null}
        <Textarea value={content} onChange={(event) => setContent(event.target.value)} aria-label="Transcript" placeholder="Type or paste a transcript. Automatic transcription is optional and not guaranteed." />
        <div className="max-h-48 space-y-1 overflow-auto">
          {segments.map((segment, index) => (
            <button
              key={`${segment.startMs}-${index}`}
              className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => {
                const time = seekTimeForSegment(segment.startMs);
                if (audioRef.current && time !== null) audioRef.current.currentTime = time;
              }}
            >
              <span className="mr-2 font-mono text-xs text-muted-foreground">{segment.startMs === null ? "—" : formatDuration(segment.startMs / 1000)}{segment.approximate ? " approx" : ""}</span>
              {segment.text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void saveTranscriptText("manual")}>Save transcript</Button>
          <label className="inline-flex items-center">
            <input
              className="sr-only"
              type="file"
              accept=".txt,text/plain"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                setContent(text);
                setSegments([]);
                setSpeechNote("Imported from a text file. Timestamps were not in the file, so playback links are unavailable.");
              }}
            />
            <span className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm">Import transcript</span>
          </label>
          <Button
            onClick={() =>
              void workspace.createNote({ title: `${title} transcript`, contentText: content, wordCount: content.split(/\s+/).filter(Boolean).length }).then(async (note) => {
                const { markdownToDoc } = await import("@/lib/notes/text");
                await workspace.saveNote({ ...note, content: markdownToDoc(content), contentText: content });
                router.push(`/notes/${note.id}`);
              })
            }
          >
            Copy into a note
          </Button>
        </div>
      </section>
    </div>
  );
}

function formatBytesSafe(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
  interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechResult) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  }
}
