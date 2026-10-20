import { timestampMs } from "@/lib/utils";

export type SyncDecision = "insert" | "update" | "pull" | "conflict" | "noop";

export function decideSync(input: {
  localUpdatedAt: string | null;
  baseUpdatedAt: string | null;
  remoteUpdatedAt: string | null;
}): SyncDecision {
  const local = timestampMs(input.localUpdatedAt);
  const remote = timestampMs(input.remoteUpdatedAt);
  const base = timestampMs(input.baseUpdatedAt);

  if (remote === null && local === null) return "noop";
  if (remote === null) return "insert";
  if (local === null) return "pull";
  if (remote === local) return "noop";

  const localDirty = base === null || local > base;
  const remoteDirty = base === null || remote > base;

  if (localDirty && remoteDirty) return "conflict";
  if (localDirty) return "update";
  if (remoteDirty) return "pull";
  return "conflict";
}

export function sortByParent<T extends { id: string; parentId: string | null }>(items: T[]) {
  const pending = [...items];
  const sorted: T[] = [];
  const seen = new Set<string>();
  while (pending.length) {
    const index = pending.findIndex((item) => !item.parentId || seen.has(item.parentId) || !pending.some((other) => other.id === item.parentId));
    if (index === -1) {
      sorted.push(...pending);
      break;
    }
    const [item] = pending.splice(index, 1);
    if (!item) break;
    seen.add(item.id);
    sorted.push(item);
  }
  return sorted;
}
