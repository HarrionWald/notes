"use client";

import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { countCharacters, countWords, docToMarkdown, markdownToDoc } from "@/lib/notes/text";
import { NOTE_STARTERS, generateReviewQuestions } from "@/lib/notes/templates";
import { saveStatusLabel, type SaveEvent } from "@/lib/save-status";
import { nextSaveStatus } from "@/lib/save-status";
import type { Note, SaveStatus } from "@/lib/types";
import { downloadText } from "@/lib/utils";

export function NoteEditor({ note }: { note: Note }) {
  const workspace = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [tagText, setTagText] = useState(workspace.tagsForNote(note.id).map((tag) => tag.name).join(", "));
  const latest = useRef(note);
  useEffect(() => {
    latest.current = note;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
    ],
    content: note.content as JSONContent,
    editorProps: { attributes: { class: "note-prose px-1 outline-none", "aria-label": "Note editor" } },
    onUpdate: ({ editor: current }) => {
      setStatus(nextSaveStatus({ type: "edit" } satisfies SaveEvent));
      schedule(current.getJSON(), current.getText());
    },
  });

  const timer = useRef<number | null>(null);
  function schedule(content: Note["content"], text: string) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persist({ ...latest.current, title, content, contentText: text, wordCount: countWords(text) });
    }, workspace.preferences.autosaveMs);
  }

  async function persist(next: Note) {
    setStatus("saving");
    const result = await workspace.saveNote(next);
    latest.current = next;
    setStatus(result);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!editor) return;
        void persist({ ...latest.current, title, content: editor.getJSON() as Note["content"], contentText: editor.getText(), wordCount: countWords(editor.getText()) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const text = editor?.getText() ?? note.contentText;
  const notebooks = workspace.snapshot.notebooks.filter((item) => !item.deletedAt);
  const classes = workspace.snapshot.classes.filter((item) => !item.deletedAt);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <article className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" role="status">
            {saveStatusLabel(status, workspace.configured)}
          </p>
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBold().run()} aria-label="Bold">B</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleItalic().run()} aria-label="Italic"><span className="italic">I</span></Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleUnderline().run()} aria-label="Underline"><span className="underline">U</span></Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleStrike().run()} aria-label="Strikethrough"><span className="line-through">S</span></Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-label="Bulleted list">List</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">1.</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleTaskList().run()} aria-label="Checklist">Check</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBlockquote().run()} aria-label="Quote">Quote</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} aria-label="Code block">Code</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const href = window.prompt("Link address");
                if (href) editor?.chain().focus().setLink({ href }).run();
              }}
            >
              Link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().undo().run()} aria-label="Undo">Undo</Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().redo().run()} aria-label="Redo">Redo</Button>
          </div>
        </div>
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setStatus("saving");
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
              void persist({ ...latest.current, title: event.target.value, content: (editor?.getJSON() as Note["content"]) ?? note.content, contentText: editor?.getText() ?? "", wordCount: countWords(editor?.getText() ?? "") });
            }, workspace.preferences.autosaveMs);
          }}
          className="w-full bg-transparent font-serif text-3xl font-semibold outline-none"
          aria-label="Note title"
        />
        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
          <EditorContent editor={editor} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {countWords(text)} words · {countCharacters(text)} characters
        </p>
      </article>
      <aside className="space-y-4">
        <label className="block text-sm">
          Notebook
          <select
            className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-2"
            value={note.notebookId ?? ""}
            onChange={(event) => void persist({ ...latest.current, notebookId: event.target.value || null })}
          >
            <option value="">None</option>
            {notebooks.map((notebook) => (
              <option key={notebook.id} value={notebook.id}>{notebook.title}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Class
          <select
            className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-2"
            value={note.classId ?? ""}
            onChange={(event) => void persist({ ...latest.current, classId: event.target.value || null })}
          >
            <option value="">None</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Tags
          <Input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            onBlur={() => void workspace.setNoteTags(note.id, tagText.split(","))}
            placeholder="lecture, exam"
            aria-label="Tags, separated by commas"
          />
        </label>
        <label className="block text-sm">
          Starter
          <select
            className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-2"
            defaultValue=""
            onChange={(event) => {
              const starter = NOTE_STARTERS.find((item) => item.id === event.target.value);
              if (!starter || !editor) return;
              const content = markdownToDoc(starter.markdown);
              editor.commands.setContent(content as JSONContent);
              void persist({ ...latest.current, templateType: starter.id, content, contentText: editor.getText(), wordCount: countWords(editor.getText()) });
            }}
          >
            <option value="">Insert a template…</option>
            {NOTE_STARTERS.map((starter) => (
              <option key={starter.id} value={starter.id}>{starter.name}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const questions = generateReviewQuestions(text);
            const markdown = ["## Review prompts", "", "These prompts were copied from your sentences by a simple rule. They are not AI-generated.", ""];
            for (const question of questions) markdown.push(`- ${question.question}`, `  - ${question.answer}`);
            if (questions.length === 0) markdown.push("- No definition lines were found. Add some, or write your own questions.");
            editor?.commands.insertContent(markdownToDoc(markdown.join("\n")).content ?? []);
          }}
        >
          Add review prompts
        </Button>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => void workspace.toggleFavorite("note", note.id)}>{workspace.isFavorite("note", note.id) ? "Unfavorite" : "Favorite"}</Button>
          <Button variant="outline" onClick={() => void workspace.duplicateNote(note).then((copy) => router.push(`/notes/${copy.id}`))}>Duplicate</Button>
          <Button variant="outline" onClick={() => downloadText(`${title || "note"}.md`, docToMarkdown(editor?.getJSON() as Note["content"] ?? note.content), "text/markdown")}>Export Markdown</Button>
          <Button variant="outline" onClick={() => downloadText(`${title || "note"}.txt`, text)}>Export text</Button>
          <Button variant="destructive" onClick={() => void workspace.softDelete("notes", latest.current).then(() => router.push("/notes"))}>Move to trash</Button>
        </div>
      </aside>
    </div>
  );
}
