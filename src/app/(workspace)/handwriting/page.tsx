"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { blankPage } from "@/lib/drawings/model";
import { createId } from "@/lib/utils";

export default function HandwritingPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const drawings = workspace.snapshot.drawings.filter((item) => !item.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Handwriting</h1>
        <Button
          onClick={() =>
            void workspace.createDrawing({ pages: [blankPage(createId(), "lined")] }).then((drawing) => router.push(`/handwriting/${drawing.id}`))
          }
        >
          New page
        </Button>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ink stays as drawing data. This app does not convert handwriting to text. Add a text box when you want typed words.
      </p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {drawings.map((drawing) => (
          <li key={drawing.id}>
            <Link className="block px-4 py-3 hover:bg-accent" href={`/handwriting/${drawing.id}`}>{drawing.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
