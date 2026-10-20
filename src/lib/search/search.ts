export type SearchDocument = {
  id: string;
  kind: "note" | "document" | "recording" | "drawing" | "notebook" | "class";
  title: string;
  text: string;
  classId: string | null;
  notebookId: string | null;
  tagIds: string[];
  updatedAt: string;
  createdAt: string;
  deletedAt: string | null;
  documentKind?: string | null;
};

export type SearchFilters = {
  query?: string;
  classId?: string | null;
  notebookId?: string | null;
  tagId?: string | null;
  documentKind?: string | null;
  sort?: "updated" | "created" | "title";
  includeDeleted?: boolean;
};

export function searchItems(items: SearchDocument[], filters: SearchFilters) {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const terms = query.split(/\s+/).filter(Boolean);
  const filtered = items.filter((item) => {
    if (!filters.includeDeleted && item.deletedAt) return false;
    if (filters.includeDeleted && !item.deletedAt) return false;
    if (filters.classId && item.classId !== filters.classId) return false;
    if (filters.notebookId && item.notebookId !== filters.notebookId) return false;
    if (filters.tagId && !item.tagIds.includes(filters.tagId)) return false;
    if (filters.documentKind && item.documentKind !== filters.documentKind) return false;
    if (terms.length === 0) return true;
    const haystack = `${item.title}\n${item.text}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  const sort = filters.sort ?? "updated";
  return filtered.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
