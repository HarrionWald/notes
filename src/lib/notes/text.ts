import type { NoteContent } from "@/lib/types";

type Mark = { type: string; attrs?: { href?: string } };
type Node = {
  type?: string;
  text?: string;
  content?: Node[];
  marks?: Mark[];
  attrs?: Record<string, unknown>;
};

export function countWords(text: string) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function countCharacters(text: string) {
  return text.length;
}

export function emptyDoc(): NoteContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function inlineMarkdown(node: Node): string {
  const children = (node.content ?? []).map(renderNode).join("");
  return children;
}

function renderNode(node: Node): string {
  if (node.type === "text") {
    let text = node.text ?? "";
    const marks = node.marks?.map((mark) => mark.type) ?? [];
    if (marks.includes("code")) text = `\`${text}\``;
    if (marks.includes("bold")) text = `**${text}**`;
    if (marks.includes("italic")) text = `*${text}*`;
    if (marks.includes("strike")) text = `~~${text}~~`;
    if (marks.includes("link")) {
      const link = node.marks?.find((mark) => mark.type === "link");
      const target = link?.attrs?.href;
      text = target ? `[${text}](${target})` : text;
    }
    return text;
  }
  const inner = (node.content ?? []).map(renderNode).join("");
  switch (node.type) {
    case "paragraph":
      return `${inner}\n\n`;
    case "heading": {
      const level = Math.min(3, Number(node.attrs?.level ?? 1));
      return `${"#".repeat(level)} ${inner}\n\n`;
    }
    case "bulletList":
      return `${(node.content ?? []).map((item) => `- ${inlineMarkdown(item).trim()}`).join("\n")}\n\n`;
    case "orderedList":
      return `${(node.content ?? []).map((item, index) => `${index + 1}. ${inlineMarkdown(item).trim()}`).join("\n")}\n\n`;
    case "taskList":
      return `${(node.content ?? [])
        .map((item) => `- [${item.attrs?.checked ? "x" : " "}] ${inlineMarkdown(item).trim()}`)
        .join("\n")}\n\n`;
    case "blockquote":
      return `${inner
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    case "codeBlock":
      return `\`\`\`\n${inner.replace(/\n\n$/, "\n")}\`\`\`\n\n`;
    case "horizontalRule":
      return `---\n\n`;
    default:
      return inner;
  }
}

export function docToMarkdown(doc: NoteContent) {
  return renderNode(doc as Node).replace(/\n{3,}/g, "\n\n").trim();
}

export function docToText(doc: NoteContent) {
  const walk = (node: Node): string => {
    if (node.text) return node.text;
    return (node.content ?? []).map(walk).join(node.type === "paragraph" || node.type === "heading" ? "\n" : "");
  };
  return walk(doc as Node).replace(/\n{3,}/g, "\n\n").trim();
}

type Inline = { type: "text"; text: string; marks?: { type: string; attrs?: Record<string, string> }[] };

function parseInline(text: string): Inline[] {
  const tokens: Inline[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: "text", text: text.slice(last, index) });
    if (match[2]) tokens.push({ type: "text", text: match[2], marks: [{ type: "bold" }] });
    else if (match[3]) tokens.push({ type: "text", text: match[3], marks: [{ type: "italic" }] });
    else if (match[4]) tokens.push({ type: "text", text: match[4], marks: [{ type: "code" }] });
    else if (match[5] && match[6]) tokens.push({ type: "text", text: match[5], marks: [{ type: "link", attrs: { href: match[6] } }] });
    last = index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
  return tokens.filter((token) => token.text.length > 0);
}

export function markdownToDoc(markdown: string): NoteContent {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: Node[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      content.push({ type: "codeBlock", content: [{ type: "text", text: code.join("\n") }] });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      content.push({ type: "heading", attrs: { level: heading[1].length }, content: parseInline(heading[2]) });
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quoted: string[] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("> ")) {
        quoted.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      content.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(quoted.join(" ")) }] });
      continue;
    }
    if (/^\|.+\|$/.test(line) && /^\|?\s*-+/.test(lines[index + 1] ?? "")) {
      const rows: string[][] = [];
      const header = splitTableRow(line);
      index += 2;
      while (index < lines.length && /^\|.+\|$/.test(lines[index] ?? "")) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }
      content.push({
        type: "table",
        content: [
          { type: "tableRow", content: header.map((cell) => ({ type: "tableHeader", content: [{ type: "paragraph", content: parseInline(cell) }] })) },
          ...rows.map((row) => ({
            type: "tableRow",
            content: row.map((cell) => ({ type: "tableCell", content: [{ type: "paragraph", content: parseInline(cell) }] })),
          })),
        ],
      });
      continue;
    }
    if (/^[-*] \[([ xX])\] /.test(line)) {
      const items: Node[] = [];
      while (index < lines.length && /^[-*] \[([ xX])\] /.test(lines[index] ?? "")) {
        const current = lines[index] ?? "";
        const checked = /^[-*] \[([xX])\]/.test(current);
        items.push({
          type: "taskItem",
          attrs: { checked },
          content: [{ type: "paragraph", content: parseInline(current.replace(/^[-*] \[.\]\s/, "")) }],
        });
        index += 1;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: Node[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index] ?? "")) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline((lines[index] ?? "").replace(/^[-*] /, "")) }] });
        index += 1;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: Node[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index] ?? "")) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline((lines[index] ?? "").replace(/^\d+\. /, "")) }] });
        index += 1;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() && !/^(#{1,3}\s|> |[-*] |\d+\. |\||```)/.test(lines[index] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    content.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
  }
  return { type: "doc", content: content.length ? (content as NoteContent["content"]) : [{ type: "paragraph" }] };
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
