export function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractTextFromSlideXml(xml: string) {
  const parts: string[] = [];
  const pattern = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  for (const match of xml.matchAll(pattern)) {
    const text = decodeXml(match[1] ?? "").trim();
    if (text) parts.push(text);
  }
  return parts.join(" ");
}

export function slideNumberFromPath(path: string) {
  const match = /slide(\d+)\.xml$/.exec(path);
  return match?.[1] ? Number(match[1]) : null;
}
