"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { RecorderPanel } from "@/components/recorder-panel";
import { useWorkspace } from "@/components/workspace-provider";
import { formatDuration, formatBytes } from "@/lib/utils";

export default function RecordingsPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const recordings = workspace.snapshot.recordings.filter((item) => !item.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recordings</h1>
      </div>
      <RecorderPanel recording={null} transcript={null} />
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {recordings.map((recording) => (
          <li key={recording.id}>
            <Link href={`/recordings/${recording.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-accent">
              <span>
                <span className="block font-medium">{recording.title}</span>
                <span className="text-xs text-muted-foreground">{recording.uploadStatus}</span>
              </span>
              <span className="text-xs text-muted-foreground">{formatDuration(recording.durationSeconds)} · {formatBytes(recording.sizeBytes)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {recordings.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Stop a recording to save it here.</p> : null}
      <Button className="mt-4" variant="ghost" onClick={() => router.push("/recordings")}>Refresh list</Button>
    </div>
  );
}
