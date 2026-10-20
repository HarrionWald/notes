import type { SaveStatus } from "@/lib/types";

export type SaveEvent =
  | { type: "edit" }
  | { type: "local-saved"; online: boolean; cloud: boolean }
  | { type: "remote-saved" }
  | { type: "remote-failed" }
  | { type: "conflict" }
  | { type: "local-failed" };

export function nextSaveStatus(event: SaveEvent): SaveStatus {
  switch (event.type) {
    case "edit":
      return "saving";
    case "local-failed":
      return "error";
    case "conflict":
      return "conflict";
    case "remote-saved":
      return "saved";
    case "remote-failed":
      return "pending";
    case "local-saved":
      if (!event.cloud) return "saved";
      return event.online ? "saving" : "offline";
  }
}

export function saveStatusLabel(status: SaveStatus, cloud: boolean) {
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return cloud ? "Saved" : "Saved on this device";
    case "pending":
      return "Saved on this device · waiting to synchronize";
    case "offline":
      return "Offline · saved on this device";
    case "conflict":
      return "Sync conflict";
    case "error":
      return "Could not save";
  }
}
