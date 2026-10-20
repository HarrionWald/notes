"use client";

import { useParams } from "next/navigation";
import { RecorderPanel } from "@/components/recorder-panel";
import { useWorkspace } from "@/components/workspace-provider";

export default function RecordingPage() {
  const params = useParams<{ id: string }>();
  const workspace = useWorkspace();
  const recording = workspace.snapshot.recordings.find((item) => item.id === params.id);
  const transcript = workspace.snapshot.transcripts.find((item) => item.recordingId === params.id && !item.deletedAt) ?? null;
  if (!recording || recording.deletedAt) return <p className="p-6 text-sm">That recording is not on this device.</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <RecorderPanel recording={recording} transcript={transcript} />
    </div>
  );
}
