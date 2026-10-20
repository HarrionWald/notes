import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/data/db";
import {
  ENTITY_ORDER,
  TABLE_NAMES,
  type BlobRecord,
  type EntityName,
  type OutboxItem,
  entityId,
  fromRow,
  outboxKey,
  toRow,
} from "@/lib/data/rows";
import { decideSync, sortByParent } from "@/lib/sync/conflicts";
import { explainSyncError } from "@/lib/sync/errors";
import { LOCAL_MEDIA_KEEP_BYTES } from "@/lib/limits";
import type { ConflictRecord, DocumentRecord, PdfAnnotation, Recording, SyncFields } from "@/lib/types";
import { nowIso } from "@/lib/utils";

let chain: Promise<unknown> = Promise.resolve();

export function enqueueWork<T>(work: () => Promise<T>) {
  const run = chain.then(work, work);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function saveLocal(entity: EntityName, item: SyncFields, cloud: boolean) {
  const db = await getDb();
  await db.put(entity, item);
  if (!cloud || item.userId === "local") return;
  const key = outboxKey(entity, item.id);
  const existing = await db.get("outbox", key);
  const entry: OutboxItem = {
    id: key,
    entity,
    entityId: item.id,
    op: "upsert",
    updatedAt: item.updatedAt,
    attempts: existing?.attempts ?? 0,
    lastError: existing?.lastError ?? null,
  };
  await db.put("outbox", entry);
}

export async function removeLocal(entity: EntityName, item: SyncFields, cloud: boolean) {
  const db = await getDb();
  await db.delete(entity, item.id);
  if (!cloud || item.userId === "local") return;
  const entry: OutboxItem = {
    id: outboxKey(entity, item.id),
    entity,
    entityId: item.id,
    op: "delete",
    updatedAt: nowIso(),
    attempts: 0,
    lastError: null,
  };
  await db.put("outbox", entry);
}

export async function pendingCount() {
  const db = await getDb();
  const items = await db.getAll("outbox");
  return items.length;
}

async function rememberConflict(conflict: ConflictRecord) {
  const db = await getDb();
  await db.put("conflicts", conflict);
}

export async function clearConflict(id: string) {
  const db = await getDb();
  await db.delete("conflicts", id);
}

type PushResult = {
  pushed: number;
  failed: { id: string; message: string }[];
  conflicts: ConflictRecord[];
};

export async function pushOutbox(client: SupabaseClient, userId: string, force: boolean): Promise<PushResult> {
  const db = await getDb();
  const items = await db.getAll("outbox");
  const failed: { id: string; message: string }[] = [];
  const conflicts: ConflictRecord[] = [];
  let pushed = 0;

  for (const entity of ENTITY_ORDER) {
    let group = items.filter((item) => item.entity === entity);
    if (entity === "folders" || entity === "sections") {
      const locals = (await db.getAll(entity)) as unknown as { id: string; parentId: string | null }[];
      const parentOf = new Map(locals.map((item) => [item.id, item.parentId]));
      const sortable = group.map((item) => ({ ...item, id: item.entityId, parentId: parentOf.get(item.entityId) ?? null }));
      const sorted = sortByParent(sortable);
      group = sorted.map((item) => group.find((original) => original.entityId === item.id)).filter((item): item is OutboxItem => Boolean(item));
    }
    for (const item of group) {
      if (item.lastError && !force) continue;
      try {
        const outcome = await pushOne(client, userId, item);
        if (outcome === "conflict") {
          item.lastError = "Sync conflict";
          await db.put("outbox", item);
          const stored = await db.get("conflicts", item.id);
          if (stored) conflicts.push(stored);
        } else {
          pushed += 1;
          await db.delete("outbox", item.id);
        }
      } catch (error) {
        const message = explainSyncError(error instanceof Error ? error.message : "Sync failed");
        item.attempts += 1;
        item.lastError = message;
        await db.put("outbox", item);
        failed.push({ id: item.id, message });
      }
    }
  }
  return { pushed, failed, conflicts };
}

async function pushOne(client: SupabaseClient, userId: string, item: OutboxItem) {
  const table = TABLE_NAMES[item.entity];
  if (item.op === "delete") {
    const { error } = await client.from(table).delete().eq("id", item.entityId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return "deleted" as const;
  }
  const db = await getDb();
  const local = (await db.get(item.entity, item.entityId)) as SyncFields | undefined;
  if (!local) return "missing" as const;
  if (local.userId !== userId) throw new Error("This record belongs to a different account.");

  let remoteUpdatedAt: string | null = null;
  if (item.entity === "annotations") {
    const annotation = local as PdfAnnotation;
    const { data, error } = await client
      .from(table)
      .select("id, updated_at")
      .eq("document_id", annotation.documentId)
      .eq("page_number", annotation.pageNumber)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data && typeof data === "object" && "id" in data && data.id !== annotation.id) {
      remoteUpdatedAt = String((data as { updated_at?: string }).updated_at ?? "");
      const decision = decideSync({ localUpdatedAt: local.updatedAt, baseUpdatedAt: local.baseUpdatedAt, remoteUpdatedAt });
      if (decision === "conflict") {
        await rememberConflict({
          id: item.id,
          entityType: item.entity,
          entityId: item.entityId,
          local,
          remote: data,
          createdAt: nowIso(),
        });
        return "conflict" as const;
      }
      annotation.id = String((data as { id: string }).id);
    }
  }

  const { data, error } = await client.from(table).select("updated_at").eq("id", local.id).maybeSingle();
  if (error) throw new Error(error.message);
  remoteUpdatedAt = data && typeof data === "object" && "updated_at" in data ? String((data as { updated_at: string }).updated_at) : null;
  const decision = decideSync({
    localUpdatedAt: local.updatedAt,
    baseUpdatedAt: local.baseUpdatedAt,
    remoteUpdatedAt,
  });
  if (decision === "conflict") {
    const full = await client.from(table).select("*").eq("id", local.id).maybeSingle();
    await rememberConflict({
      id: item.id,
      entityType: item.entity,
      entityId: item.entityId,
      local,
      remote: full.data ? fromRow(item.entity, full.data as Record<string, unknown>) : data,
      createdAt: nowIso(),
    });
    return "conflict" as const;
  }
  if (decision === "pull" && remoteUpdatedAt) {
    const full = await client.from(table).select("*").eq("id", local.id).maybeSingle();
    if (full.error) throw new Error(full.error.message);
    if (full.data) await db.put(item.entity, fromRow(item.entity, full.data as Record<string, unknown>));
    return "pulled" as const;
  }
  if (decision === "noop") return "noop" as const;
  const row = toRow(item.entity, local);
  const upserted = await client.from(table).upsert(row as never);
  if (upserted.error) throw new Error(upserted.error.message);
  local.baseUpdatedAt = local.updatedAt;
  await db.put(item.entity, local);
  await client.from("sync_metadata").upsert(
    {
      id: local.id,
      user_id: userId,
      entity_type: item.entity,
      entity_id: local.id,
      local_updated_at: local.updatedAt,
      remote_updated_at: local.updatedAt,
      sync_status: "synced",
      last_error: null,
      updated_at: nowIso(),
    },
    { onConflict: "user_id,entity_type,entity_id" },
  );
  return "pushed" as const;
}

export async function pullRemote(client: SupabaseClient, userId: string) {
  const db = await getDb();
  let pulled = 0;
  const conflicts: ConflictRecord[] = [];
  for (const entity of ENTITY_ORDER) {
    const cursor = await db.get("meta", `pull:${entity}`);
    let query = client.from(TABLE_NAMES[entity]).select("*").eq("user_id", userId);
    if (cursor?.value) query = query.gte("updated_at", cursor.value);
    const { data, error } = await query;
    if (error) throw new Error(explainSyncError(error.message));
    let maxSeen = cursor?.value ?? "";
    for (const row of data ?? []) {
      const remote = fromRow(entity, row as Record<string, unknown>);
      const local = (await db.get(entity, remote.id)) as SyncFields | undefined;
      const decision = decideSync({
        localUpdatedAt: local?.updatedAt ?? null,
        baseUpdatedAt: local?.baseUpdatedAt ?? null,
        remoteUpdatedAt: remote.updatedAt,
      });
      if (decision === "conflict" && local) {
        const conflict: ConflictRecord = {
          id: outboxKey(entity, remote.id),
          entityType: entity,
          entityId: remote.id,
          local,
          remote,
          createdAt: nowIso(),
        };
        await rememberConflict(conflict);
        conflicts.push(conflict);
      } else if (decision === "pull" || !local) {
        await db.put(entity, remote);
        pulled += 1;
      }
      if (remote.updatedAt > maxSeen) maxSeen = remote.updatedAt;
    }
    if (maxSeen) await db.put("meta", { id: `pull:${entity}`, value: maxSeen });
  }
  return { pulled, conflicts };
}

export async function claimLocalRecords(userId: string) {
  const db = await getDb();
  for (const entity of ENTITY_ORDER) {
    const records = (await db.getAll(entity)) as SyncFields[];
    for (const record of records) {
      if (record.userId !== "local") continue;
      const next = { ...record, userId, baseUpdatedAt: null };
      await db.put(entity, next);
      await saveLocal(entity, next, true);
    }
  }
}

export async function uploadPendingFiles(options: {
  client: SupabaseClient;
  supabaseUrl: string;
  anonKey: string;
  userId: string;
  keepLocalMedia: boolean;
  force: boolean;
  onProgress?: (id: string, ratio: number) => void;
}) {
  const db = await getDb();
  const documents = (await db.getAll("documents")) as DocumentRecord[];
  const recordings = (await db.getAll("recordings")) as Recording[];
  const targets: { record: DocumentRecord | Recording; kind: "documents" | "recordings" }[] = [
    ...documents.map((record) => ({ record, kind: "documents" as const })),
    ...recordings.map((record) => ({ record, kind: "recordings" as const })),
  ];
  for (const target of targets) {
    const record = target.record;
    if (record.deletedAt) continue;
    if (record.uploadStatus === "uploaded" || record.uploadStatus === "local") continue;
    if (record.uploadStatus === "error" && !options.force) continue;
    const blobRecord = await db.get("blobs", record.id);
    if (!blobRecord) continue;
    const { data: sessionData } = await options.client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sign in again before uploading files.");
    record.uploadStatus = "uploading";
    record.uploadError = null;
    await db.put(target.kind, record);
    try {
      const path = record.storagePath ?? `${options.userId}/${target.kind}/${record.id}/${blobRecord.fileName}`;
      await uploadFile({
        supabaseUrl: options.supabaseUrl,
        anonKey: options.anonKey,
        accessToken: token,
        path,
        blob: blobRecord.blob,
        mimeType: blobRecord.mimeType || record.mimeType,
        onProgress: (ratio) => options.onProgress?.(record.id, ratio),
      });
      record.storagePath = path;
      record.uploadStatus = "uploaded";
      record.uploadError = null;
      record.updatedAt = nowIso();
      await db.put(target.kind, record);
      await saveLocal(target.kind, record, true);
      if (!options.keepLocalMedia && record.sizeBytes > LOCAL_MEDIA_KEEP_BYTES) await db.delete("blobs", record.id);
    } catch (error) {
      record.uploadStatus = "error";
      record.uploadError = explainSyncError(error instanceof Error ? error.message : "Upload failed");
      await db.put(target.kind, record);
    }
  }
}

export function uploadFile(options: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  path: string;
  blob: Blob;
  mimeType: string;
  onProgress?: (ratio: number) => void;
}) {
  const endpoint = `${options.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/files/${options.path.split("/").map(encodeURIComponent).join("/")}`;
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${options.accessToken}`);
    xhr.setRequestHeader("apikey", options.anonKey);
    xhr.setRequestHeader("Content-Type", options.mimeType || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 409) resolve();
      else reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("network upload failed"));
    xhr.send(options.blob);
  });
}

export async function putBlob(record: BlobRecord) {
  const db = await getDb();
  await db.put("blobs", record);
}

export async function getBlob(id: string) {
  const db = await getDb();
  return db.get("blobs", id);
}

export async function signedFileUrl(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from("files").createSignedUrl(path, 60 * 60);
  if (error) throw new Error(explainSyncError(error.message));
  return data.signedUrl;
}

export async function removeRemoteFile(client: SupabaseClient, path: string) {
  const { error } = await client.storage.from("files").remove([path]);
  if (error) throw new Error(explainSyncError(error.message));
}

export function syncableId(item: unknown) {
  return entityId(item);
}
