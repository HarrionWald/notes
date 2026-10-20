"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { validateUploadMetadata } from "@/app/actions/uploads";
import { createBackup, mergeByUpdatedAt, parseBackup } from "@/lib/data/backup";
import { readSnapshot } from "@/lib/data/db";
import { outboxKey, type EntityName } from "@/lib/data/rows";
import {
  claimLocalRecords,
  clearConflict,
  enqueueWork,
  getBlob,
  pendingCount,
  pullRemote,
  pushOutbox,
  putBlob,
  removeLocal,
  removeRemoteFile,
  saveLocal,
  signedFileUrl,
  uploadPendingFiles,
} from "@/lib/data/sync";
import { getDb } from "@/lib/data/db";
import { DEFAULT_PREFERENCES, estimateUsage } from "@/lib/limits";
import { emptyDoc } from "@/lib/notes/text";
import { explainSyncError } from "@/lib/sync/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";
import type {
  ClassItem,
  ConflictRecord,
  DocumentRecord,
  Drawing,
  Favorite,
  FavoriteTarget,
  Folder,
  Note,
  Notebook,
  PdfAnnotation,
  Preferences,
  Recording,
  SaveStatus,
  Section,
  Snapshot,
  SyncFields,
  Tag,
  Transcript,
} from "@/lib/types";
import { createId, downloadText, nowIso } from "@/lib/utils";

const EMPTY: Snapshot = {
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
};

type SessionUser = { id: string; email: string };

type WorkspaceValue = {
  ready: boolean;
  configured: boolean;
  user: SessionUser | null;
  online: boolean;
  syncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  pending: number;
  uploadProgress: Record<string, number>;
  preferences: Preferences;
  snapshot: Snapshot;
  usage: ReturnType<typeof estimateUsage>;
  notify: (message: string) => void;
  toasts: { id: string; message: string }[];
  setPreferences: (patch: Partial<Preferences>) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  syncNow: () => Promise<void>;
  resolveConflict: (id: string, choice: "mine" | "theirs" | "both") => Promise<void>;
  saveNote: (note: Note) => Promise<SaveStatus>;
  createNote: (partial?: Partial<Note>) => Promise<Note>;
  duplicateNote: (note: Note) => Promise<Note>;
  saveNotebook: (notebook: Notebook) => Promise<void>;
  createNotebook: (partial?: Partial<Notebook>) => Promise<Notebook>;
  saveSection: (section: Section) => Promise<void>;
  createSection: (notebookId: string, title: string, parentId?: string | null) => Promise<Section>;
  saveClass: (item: ClassItem) => Promise<void>;
  createClass: (partial?: Partial<ClassItem>) => Promise<ClassItem>;
  saveFolder: (folder: Folder) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  saveDocument: (document: DocumentRecord) => Promise<SaveStatus>;
  saveRecording: (recording: Recording) => Promise<SaveStatus>;
  saveTranscript: (transcript: Transcript) => Promise<void>;
  saveDrawing: (drawing: Drawing) => Promise<SaveStatus>;
  saveAnnotation: (annotation: PdfAnnotation) => Promise<void>;
  createDrawing: (partial?: Partial<Drawing>) => Promise<Drawing>;
  setNoteTags: (noteId: string, names: string[]) => Promise<void>;
  tagsForNote: (noteId: string) => Tag[];
  toggleFavorite: (targetType: FavoriteTarget, targetId: string) => Promise<void>;
  isFavorite: (targetType: FavoriteTarget, targetId: string) => boolean;
  softDelete: (entity: EntityName, record: SyncFields) => Promise<void>;
  restore: (entity: EntityName, record: SyncFields) => Promise<void>;
  permanentDelete: (entity: EntityName, record: SyncFields & { storagePath?: string | null }) => Promise<void>;
  emptyTrash: () => Promise<void>;
  storeBlob: (id: string, file: Blob, fileName: string, mimeType: string) => Promise<void>;
  fileUrl: (id: string, storagePath: string | null) => Promise<string | null>;
  exportData: () => void;
  importData: (raw: unknown) => Promise<string | null>;
  stamp: <T extends Record<string, unknown>>(partial: T) => T & SyncFields;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const index = items.findIndex((entry) => entry.id === item.id);
  if (index < 0) return [item, ...items];
  const next = items.slice();
  next[index] = item;
  return next;
}

const PREFERENCES_EVENT = "notes-preferences";

function subscribePreferences(callback: () => void) {
  window.addEventListener(PREFERENCES_EVENT, callback);
  return () => window.removeEventListener(PREFERENCES_EVENT, callback);
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const SERVER_PREFERENCES: Preferences = { ...DEFAULT_PREFERENCES };
let preferenceCache: { raw: string | null; value: Preferences } = { raw: null, value: SERVER_PREFERENCES };

function readPreferences(): Preferences {
  if (typeof window === "undefined") return SERVER_PREFERENCES;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("notes-preferences");
  } catch {
    return SERVER_PREFERENCES;
  }
  if (preferenceCache.raw === raw) return preferenceCache.value;
  if (!raw) {
    preferenceCache = { raw, value: SERVER_PREFERENCES };
    return SERVER_PREFERENCES;
  }
  try {
    const value: Preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    preferenceCache = { raw, value };
    return value;
  } catch {
    preferenceCache = { raw, value: SERVER_PREFERENCES };
    return SERVER_PREFERENCES;
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const preferences = useSyncExternalStore(subscribePreferences, readPreferences, () => SERVER_PREFERENCES);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const snapshotRef = useRef(snapshot);
  const userRef = useRef(user);
  const prefsRef = useRef(preferences);
  useEffect(() => {
    snapshotRef.current = snapshot;
    userRef.current = user;
    prefsRef.current = preferences;
  });
  const configured = isSupabaseConfigured();

  const notify = useCallback((message: string) => {
    const id = createId();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    const next = await readSnapshot();
    setSnapshot(next);
    setPending(await pendingCount());
    return next;
  }, []);

  const cloudOn = Boolean(user);

  const remember = useCallback((entity: EntityName, record: SyncFields) => {
    setSnapshot((current) => {
      const list = current[entity] as SyncFields[];
      return { ...current, [entity]: upsertById(list, record) };
    });
  }, []);

  const finishSave = useCallback(
    async (entity: EntityName, record: SyncFields, withFiles = false): Promise<SaveStatus> => {
      try {
        await saveLocal(entity, record, cloudOn);
        remember(entity, record);
        if (!cloudOn) return "saved";
        if (!navigator.onLine) return "offline";
        if (!prefsRef.current.autoSync) return "pending";
        const client = getBrowserSupabase();
        const env = supabaseEnv();
        const currentUser = userRef.current;
        if (!client || !env || !currentUser) return "pending";
        await enqueueWork(async () => {
          const result = await pushOutbox(client, currentUser.id, false);
          if (result.failed[0]) setSyncError(result.failed[0].message);
          if (withFiles) {
            await uploadPendingFiles({
              client,
              supabaseUrl: env.url,
              anonKey: env.anonKey,
              userId: currentUser.id,
              keepLocalMedia: prefsRef.current.keepLocalMedia,
              force: false,
              onProgress: (id, ratio) => setUploadProgress((current) => ({ ...current, [id]: ratio })),
            });
          }
        });
        await refresh();
        const entry = await (await getDb()).get("outbox", outboxKey(entity, record.id));
        if (!entry) return "saved";
        if (entry.lastError === "Sync conflict") return "conflict";
        return "pending";
      } catch (error) {
        setSyncError(explainSyncError(error instanceof Error ? error.message : "Save failed"));
        return "error";
      }
    },
    [cloudOn, refresh, remember],
  );

  const syncNow = useCallback(async () => {
    const client = getBrowserSupabase();
    const env = supabaseEnv();
    const currentUser = userRef.current;
    if (!client || !env || !currentUser) {
      notify("Add your free Supabase keys in .env.local to synchronize.");
      return;
    }
    if (!navigator.onLine) {
      setSyncError("You are offline. Changes stay on this device until a connection returns.");
      return;
    }
    setSyncing(true);
    try {
      await enqueueWork(async () => {
        await pullRemote(client, currentUser.id);
        const result = await pushOutbox(client, currentUser.id, true);
        await uploadPendingFiles({
          client,
          supabaseUrl: env.url,
          anonKey: env.anonKey,
          userId: currentUser.id,
          keepLocalMedia: prefsRef.current.keepLocalMedia,
          force: true,
          onProgress: (id, ratio) => setUploadProgress((current) => ({ ...current, [id]: ratio })),
        });
        if (result.failed[0]) setSyncError(result.failed[0].message);
        else if (result.conflicts.length) setSyncError("A sync conflict needs your decision.");
        else setSyncError(null);
      });
      setLastSyncedAt(nowIso());
    } catch (error) {
      setSyncError(explainSyncError(error instanceof Error ? error.message : "Sync failed"));
    } finally {
      await refresh();
      setSyncing(false);
    }
  }, [notify, refresh]);

  useEffect(() => {
    let ignore = false;
    const supabase = getBrowserSupabase();
    async function boot() {
      let sessionUserId: string | null = null;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;
        if (sessionUser) {
          sessionUserId = sessionUser.id;
          await claimLocalRecords(sessionUser.id);
          if (!ignore) setUser({ id: sessionUser.id, email: sessionUser.email ?? "" });
        }
      }
      if (!ignore) {
        await refresh();
        setReady(true);
        if (sessionUserId && prefsRef.current.autoSync && navigator.onLine) void syncNow();
      }
    }
    void boot();
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
    });
    const goOnline = () => {
      if (prefsRef.current.autoSync) void syncNow();
    };
    window.addEventListener("online", goOnline);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      ignore = true;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("online", goOnline);
    };
  }, [refresh, syncNow]);

  const stamp = useCallback(<T extends Record<string, unknown>>(partial: T) => {
    const timestamp = nowIso();
    return {
      id: createId(),
      userId: userRef.current?.id ?? "local",
      createdAt: timestamp,
      updatedAt: timestamp,
      baseUpdatedAt: null,
      deletedAt: null,
      ...partial,
    };
  }, []);

  const touch = useCallback(<T extends SyncFields>(record: T, patch: Partial<T>) => {
    return { ...record, ...patch, updatedAt: nowIso() };
  }, []);

  const setPreferences = useCallback((patch: Partial<Preferences>) => {
    const next = { ...readPreferences(), ...patch };
    localStorage.setItem("notes-preferences", JSON.stringify(next));
    if (patch.theme) {
      localStorage.setItem("notes-theme", patch.theme);
      window.dispatchEvent(new Event("notes-theme-change"));
    }
    window.dispatchEvent(new Event(PREFERENCES_EVENT));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return "Add the Supabase URL and anon key to .env.local first.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return explainSyncError(error.message);
    const { data } = await supabase.auth.getUser();
    if (data.user) await claimLocalRecords(data.user.id);
    await refresh();
    if (prefsRef.current.autoSync) await syncNow();
    return null;
  }, [refresh, syncNow]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return "Add the Supabase URL and anon key to .env.local first.";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { display_name: name } },
    });
    if (error) return explainSyncError(error.message);
    if (!data.session) return "Account created. Confirm the email if your project asks for it, then sign in. The free email service only delivers to addresses on your Supabase team.";
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await getBrowserSupabase()?.auth.signOut();
    setUser(null);
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return "Supabase is not configured.";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
    return error ? explainSyncError(error.message) : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return "Supabase is not configured.";
    const { error } = await supabase.auth.updateUser({ password });
    return error ? explainSyncError(error.message) : null;
  }, []);

  const resolveConflict = useCallback(
    async (id: string, choice: "mine" | "theirs" | "both") => {
      const conflict = snapshotRef.current.conflicts.find((item) => item.id === id);
      if (!conflict) return;
      const entity = conflict.entityType as EntityName;
      const local = conflict.local as SyncFields;
      const remote = conflict.remote as SyncFields | null;
      const db = await getDb();
      await db.delete("outbox", id);
      if (choice === "theirs" && remote) {
        await saveLocal(entity, { ...remote, baseUpdatedAt: remote.updatedAt }, false);
      } else if (choice === "both" && remote) {
        const copy = { ...local, id: createId(), updatedAt: nowIso(), baseUpdatedAt: null, title: `${"title" in local ? String((local as { title?: string }).title ?? "Copy") : "Copy"} (local copy)` };
        await saveLocal(entity, copy as SyncFields, cloudOn);
        await saveLocal(entity, { ...remote, baseUpdatedAt: remote.updatedAt }, false);
      } else {
        const mine = { ...local, updatedAt: nowIso(), baseUpdatedAt: remote?.updatedAt ?? local.baseUpdatedAt };
        await saveLocal(entity, mine, cloudOn);
      }
      await clearConflict(id);
      await refresh();
      if (choice !== "theirs") await syncNow();
    },
    [cloudOn, refresh, syncNow],
  );

  const value = useMemo<WorkspaceValue>(() => {
    const usage = estimateUsage(snapshot);
    return {
      ready,
      configured,
      user,
      online,
      syncing,
      syncError,
      lastSyncedAt,
      pending,
      uploadProgress,
      preferences,
      snapshot,
      usage,
      notify,
      toasts,
      setPreferences,
      signIn,
      signUp,
      signOut,
      sendReset,
      updatePassword,
      syncNow,
      resolveConflict,
      stamp,
      saveNote: (note) => finishSave("notes", note),
      createNote: async (partial) => {
        const note = stamp({
          title: "Untitled",
          content: emptyDoc(),
          contentText: "",
          wordCount: 0,
          notebookId: null,
          sectionId: null,
          classId: null,
          folderId: null,
          templateType: null,
          sourceDocumentId: null,
          ...partial,
        }) as Note;
        await finishSave("notes", note);
        return note;
      },
      duplicateNote: async (note) => {
        const copy = stamp({ ...note, title: `${note.title} copy`, baseUpdatedAt: null }) as Note;
        copy.id = createId();
        await finishSave("notes", copy);
        return copy;
      },
      saveNotebook: async (notebook) => {
        await finishSave("notebooks", notebook);
      },
      createNotebook: async (partial) => {
        const notebook = stamp({ title: "Untitled notebook", description: "", color: "#0f5e5b", classId: null, folderId: null, ...partial }) as Notebook;
        await finishSave("notebooks", notebook);
        return notebook;
      },
      saveSection: async (section) => {
        await finishSave("sections", section);
      },
      createSection: async (notebookId, title, parentId = null) => {
        const section = stamp({ notebookId, title, parentId, position: snapshot.sections.length }) as Section;
        await finishSave("sections", section);
        return section;
      },
      saveClass: async (item) => {
        await finishSave("classes", item);
      },
      createClass: async (partial) => {
        const item = stamp({ name: "New class", subject: "", description: "", color: "#0f5e5b", ...partial }) as ClassItem;
        await finishSave("classes", item);
        return item;
      },
      saveFolder: async (folder) => {
        await finishSave("folders", folder);
      },
      createFolder: async (name, parentId = null) => {
        const folder = stamp({ name, parentId }) as Folder;
        await finishSave("folders", folder);
        return folder;
      },
      saveDocument: (document) => finishSave("documents", document, true),
      saveRecording: (recording) => finishSave("recordings", recording, true),
      saveTranscript: async (transcript) => {
        await finishSave("transcripts", transcript);
      },
      saveDrawing: (drawing) => finishSave("drawings", drawing),
      saveAnnotation: async (annotation) => {
        await finishSave("annotations", annotation);
      },
      createDrawing: async (partial) => {
        const drawing = stamp({ title: "Handwriting", notebookId: null, classId: null, pages: [], ...partial }) as Drawing;
        await finishSave("drawings", drawing);
        return drawing;
      },
      setNoteTags: async (noteId, names) => {
        const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
        const current = snapshotRef.current;
        for (const name of wanted) {
          let tag = current.tags.find((item) => item.name.toLowerCase() === name.toLowerCase() && !item.deletedAt);
          if (!tag) {
            tag = stamp({ name, color: "#78716c" }) as Tag;
            await saveLocal("tags", tag, cloudOn);
          }
          const existing = current.noteTags.find((item) => item.noteId === noteId && item.tagId === tag.id);
          const link = existing ? { ...existing, deletedAt: null, updatedAt: nowIso() } : (stamp({ noteId, tagId: tag.id }) as import("@/lib/types").NoteTag);
          await saveLocal("noteTags", link, cloudOn);
        }
        for (const link of current.noteTags.filter((item) => item.noteId === noteId)) {
          const tag = current.tags.find((item) => item.id === link.tagId);
          if (!tag || !wanted.some((name) => name.toLowerCase() === tag.name.toLowerCase())) await removeLocal("noteTags", link, cloudOn);
        }
        await refresh();
      },
      tagsForNote: (noteId) => {
        const ids = new Set(snapshot.noteTags.filter((item) => item.noteId === noteId && !item.deletedAt).map((item) => item.tagId));
        return snapshot.tags.filter((tag) => ids.has(tag.id) && !tag.deletedAt);
      },
      toggleFavorite: async (targetType, targetId) => {
        const existing = snapshotRef.current.favorites.find((item) => item.targetType === targetType && item.targetId === targetId && !item.deletedAt);
        if (existing) await removeLocal("favorites", existing, cloudOn);
        else await saveLocal("favorites", stamp({ targetType, targetId }) as Favorite, cloudOn);
        await refresh();
      },
      isFavorite: (targetType, targetId) => snapshot.favorites.some((item) => !item.deletedAt && item.targetType === targetType && item.targetId === targetId),
      softDelete: async (entity, record) => {
        await finishSave(entity, touch(record, { deletedAt: nowIso() }));
      },
      restore: async (entity, record) => {
        await finishSave(entity, touch(record, { deletedAt: null }));
      },
      permanentDelete: async (entity, record) => {
        await removeLocal(entity, record, cloudOn);
        const db = await getDb();
        await db.delete("blobs", record.id);
        setSnapshot((current) => {
          const list = (current[entity] as SyncFields[]).filter((item) => item.id !== record.id);
          return { ...current, [entity]: list };
        });
        const client = getBrowserSupabase();
        if (client && record.storagePath) {
          try {
            await removeRemoteFile(client, record.storagePath);
          } catch (error) {
            notify(explainSyncError(error instanceof Error ? error.message : "The file could not be deleted remotely."));
          }
        }
        if (cloudOn && navigator.onLine) await syncNow();
      },
      emptyTrash: async () => {
        const current = snapshotRef.current;
        const groups: [EntityName, SyncFields[]][] = [
          ["notes", current.notes],
          ["notebooks", current.notebooks],
          ["sections", current.sections],
          ["classes", current.classes],
          ["folders", current.folders],
          ["documents", current.documents],
          ["recordings", current.recordings],
          ["drawings", current.drawings],
        ];
        for (const [entity, records] of groups) {
          for (const record of records) {
            if (record.deletedAt) await removeLocal(entity, record, cloudOn);
          }
        }
        await refresh();
        if (cloudOn) await syncNow();
      },
      storeBlob: async (id, file, fileName, mimeType) => {
        await putBlob({ id, blob: file, fileName, mimeType });
      },
      fileUrl: async (id, storagePath) => {
        const blob = await getBlob(id);
        if (blob) return URL.createObjectURL(blob.blob);
        const client = getBrowserSupabase();
        if (!client || !storagePath) return null;
        try {
          return await signedFileUrl(client, storagePath);
        } catch (error) {
          notify(explainSyncError(error instanceof Error ? error.message : "The file could not be opened."));
          return null;
        }
      },
      exportData: () => {
        const payload = JSON.stringify(createBackup(snapshotRef.current, nowIso()), null, 2);
        if (payload.length > 8 * 1024 * 1024) notify("This backup is large because drawings or extracted text are included. File binaries are not embedded.");
        downloadText(`notes-backup-${new Date().toISOString().slice(0, 10)}.json`, payload, "application/json");
      },
      importData: async (raw) => {
        const parsed = parseBackup(raw);
        if (!parsed.ok) return parsed.error;
        const current = snapshotRef.current;
        const keys = ["classes", "folders", "notebooks", "sections", "tags", "documents", "notes", "noteTags", "recordings", "transcripts", "drawings", "annotations", "favorites"] as const;
        for (const key of keys) {
          const currentList = current[key] as { id: string; updatedAt: string }[];
          const incomingList = parsed.backup[key] as { id: string; updatedAt: string }[];
          const merged = mergeByUpdatedAt(currentList, incomingList);
          for (const item of merged) {
            const existing = currentList.find((entry) => entry.id === item.id);
            if (existing !== item) await saveLocal(key, item as SyncFields, cloudOn);
          }
        }
        await refresh();
        notify("Backup imported. Newer copies were kept, and older copies were left untouched.");
        return null;
      },
    };
  }, [
    ready,
    configured,
    user,
    online,
    syncing,
    syncError,
    lastSyncedAt,
    pending,
    uploadProgress,
    preferences,
    snapshot,
    notify,
    toasts,
    setPreferences,
    signIn,
    signUp,
    signOut,
    sendReset,
    updatePassword,
    syncNow,
    resolveConflict,
    stamp,
    finishSave,
    refresh,
    cloudOn,
    touch,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
            {toast.message}
          </div>
        ))}
      </div>
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

export async function prepareUpload(file: File, limitBytes: number) {
  const local = (await import("@/lib/files/validate")).validateFile({
    name: file.name,
    size: file.size,
    type: file.type,
    limitBytes,
  });
  if (!local.ok) return local;
  if (!isSupabaseConfigured()) return local;
  try {
    const remote = await validateUploadMetadata({ name: file.name, size: file.size, type: file.type, limitBytes });
    if (!remote.ok) return remote;
  } catch {
    return { ok: false as const, error: "The server could not validate this upload. It was not sent." };
  }
  return local;
}

export type { ConflictRecord };
