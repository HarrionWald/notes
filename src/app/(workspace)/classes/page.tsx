"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function ClassesPage() {
  const workspace = useWorkspace();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const classes = workspace.snapshot.classes.filter((item) => !item.deletedAt);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Classes</h1>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void workspace.createClass({ name: name.trim(), subject: subject.trim() });
          setName("");
          setSubject("");
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Class name" aria-label="Class name" />
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" aria-label="Subject" />
        <Button type="submit">Add class</Button>
      </form>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {classes.map((item) => (
          <li key={item.id}>
            <Link href={`/classes/${item.id}`} className="block rounded-xl border border-border bg-card p-4 hover:bg-accent">
              <span className="font-medium">{item.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{item.subject || "No subject"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
