export function speechSupport(recognition: unknown) {
  if (!recognition) {
    return { supported: false as const, reason: "This browser does not expose the Web Speech API." };
  }
  return { supported: true as const };
}

export function segmentFromResult(text: string, elapsedMs: number) {
  return {
    text: text.trim(),
    startMs: Math.max(0, Math.round(elapsedMs)),
    approximate: true,
  };
}

export function seekTimeForSegment(startMs: number | null) {
  if (startMs === null || startMs < 0) return null;
  return startMs / 1000;
}
