"use client";

import {
  BookOpen,
  FileText,
  Files,
  GraduationCap,
  Home,
  Menu,
  Mic,
  PenLine,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Cloud,
  CloudOff,
  Loader2,
  PanelLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { NAV_ITEMS, layoutMode } from "@/lib/layout";
import { saveStatusLabel } from "@/lib/save-status";
import { searchItems, type SearchDocument } from "@/lib/search/search";
import { cn } from "@/lib/utils";

const ICONS = {
  Home,
  "All Notes": FileText,
  Notebooks: BookOpen,
  Classes: GraduationCap,
  Documents: Files,
  Recordings: Mic,
  Handwriting: PenLine,
  Favorites: Star,
  Trash: Trash2,
  Settings,
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    if (workspace.ready && workspace.configured && !workspace.user) router.replace("/login");
  }, [workspace.ready, workspace.configured, workspace.user, router]);

  useEffect(() => {
    const update = () => setMode(layoutMode(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void workspace.createNote().then((note) => router.push(`/notes/${note.id}`));
      }
      if (meta && event.key === "\\") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, workspace]);

  const results = useMemo(() => {
    const docs: SearchDocument[] = [
      ...workspace.snapshot.notes.map((note) => ({
        id: note.id,
        kind: "note" as const,
        title: note.title,
        text: note.contentText,
        classId: note.classId,
        notebookId: note.notebookId,
        tagIds: workspace.snapshot.noteTags.filter((link) => link.noteId === note.id).map((link) => link.tagId),
        updatedAt: note.updatedAt,
        createdAt: note.createdAt,
        deletedAt: note.deletedAt,
      })),
      ...workspace.snapshot.documents.map((document) => ({
        id: document.id,
        kind: "document" as const,
        title: document.title,
        text: document.extractedText,
        classId: document.classId,
        notebookId: document.notebookId,
        tagIds: [],
        updatedAt: document.updatedAt,
        createdAt: document.createdAt,
        deletedAt: document.deletedAt,
        documentKind: document.kind,
      })),
    ];
    return searchItems(docs, { query }).slice(0, 12);
  }, [query, workspace.snapshot]);

  if (!workspace.ready || (workspace.configured && !workspace.user)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading Notes…</p>
      </div>
    );
  }

  const drawer = mode !== "desktop";
  const conflict = workspace.snapshot.conflicts[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      {drawer && open ? <button className="fixed inset-0 z-30 bg-black/40" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-sidebar",
          drawer ? "w-72" : collapsed ? "w-[4.5rem]" : "w-64",
          drawer && !open && "-translate-x-full",
          "transition-transform lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center gap-2 px-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">N</div>
          {!collapsed || drawer ? <span className="font-semibold tracking-tight">Notes</span> : null}
        </div>
        <nav className="flex-1 space-y-1 px-2" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.label];
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm", active ? "bg-accent text-accent-foreground" : "hover:bg-accent/70")}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed || drawer ? item.label : <span className="sr-only">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          {!collapsed || drawer ? <p className="truncate">{workspace.user?.email ?? "Local only"}</p> : null}
          <p className="mt-1">{workspace.online ? "Online" : "Offline"}</p>
        </div>
      </aside>
      <div className={cn("flex min-h-screen flex-col", drawer ? "" : collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur">
          {drawer ? (
            <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Collapse sidebar" onClick={() => setCollapsed((value) => !value)}>
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <button className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm text-muted-foreground" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
            <span className="truncate">Search notes and documents</span>
            <span className="ml-auto hidden text-xs sm:inline">Ctrl K</span>
          </button>
          <Button variant="ghost" size="icon" aria-label={workspace.syncing ? "Synchronizing" : workspace.online ? "Synchronization status" : "Offline"} onClick={() => void workspace.syncNow()}>
            {workspace.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : workspace.online ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={() => void workspace.createNote().then((note) => router.push(`/notes/${note.id}`))}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New note</span>
          </Button>
        </header>
        {!workspace.configured ? (
          <div className="border-b border-border bg-accent px-4 py-2 text-sm text-accent-foreground">
            This browser is in local-only mode. Add your free Supabase keys to <code>.env.local</code> to sign in and synchronize. See Settings for the steps.
          </div>
        ) : null}
        {workspace.syncError ? <div className="border-b border-border bg-card px-4 py-2 text-sm text-destructive">{workspace.syncError}</div> : null}
        {workspace.pending > 0 ? (
          <div className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
            {workspace.pending} change{workspace.pending === 1 ? "" : "s"} waiting to synchronize. {saveStatusLabel(workspace.online ? "pending" : "offline", true)}
          </div>
        ) : null}
        <main id="content" className="flex-1">
          {children}
        </main>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen} title="Search" description="Searches notes and extracted document text on this device. Remote full-text search runs when you synchronize.">
        <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your study material" aria-label="Search query" />
        <ul className="mt-3 space-y-1">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <Link
                href={result.kind === "note" ? `/notes/${result.id}` : `/documents/${result.id}`}
                className="block rounded-lg px-2 py-2 hover:bg-accent"
                onClick={() => setSearchOpen(false)}
              >
                <span className="block text-sm font-medium">{result.title || "Untitled"}</span>
                <span className="block text-xs text-muted-foreground">{result.kind}</span>
              </Link>
            </li>
          ))}
          {query && results.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground">No matches.</li> : null}
        </ul>
      </Dialog>
      <Dialog open={Boolean(conflict)} onOpenChange={() => undefined} title="Choose which version to keep" description="Both copies changed. Nothing will be discarded until you choose.">
        {conflict ? (
          <div className="space-y-3 text-sm">
            <p>A {conflict.entityType.replace(/s$/, "")} was edited in two places.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <pre className="max-h-40 overflow-auto rounded-lg bg-secondary p-2 text-xs">{JSON.stringify(conflict.local, null, 2).slice(0, 500)}</pre>
              <pre className="max-h-40 overflow-auto rounded-lg bg-secondary p-2 text-xs">{JSON.stringify(conflict.remote, null, 2).slice(0, 500)}</pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void workspace.resolveConflict(conflict.id, "mine")}>Keep mine</Button>
              <Button variant="outline" onClick={() => void workspace.resolveConflict(conflict.id, "theirs")}>Keep the other version</Button>
              <Button variant="secondary" onClick={() => void workspace.resolveConflict(conflict.id, "both")}>Keep both</Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
