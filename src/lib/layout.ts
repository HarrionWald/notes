export type LayoutMode = "mobile" | "tablet" | "desktop";

export function layoutMode(width: number): LayoutMode {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/notes", label: "All Notes" },
  { href: "/notebooks", label: "Notebooks" },
  { href: "/classes", label: "Classes" },
  { href: "/documents", label: "Documents" },
  { href: "/recordings", label: "Recordings" },
  { href: "/handwriting", label: "Handwriting" },
  { href: "/favorites", label: "Favorites" },
  { href: "/trash", label: "Trash" },
  { href: "/settings", label: "Settings" },
] as const;
