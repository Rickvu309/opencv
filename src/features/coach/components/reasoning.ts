export interface ReasoningStep {
  title: string;
  body: string;
}

export function stepsFromReasoning(text: string): ReasoningStep[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const first = (lines[0] ?? "").replace(/^#+\s*/, "").trim();
    const rest = lines.slice(1).join("\n").trim();
    if (rest) return { title: first, body: rest };
    const pause = first.search(/[.!?]\s/);
    if (pause > 8 && pause < 72) {
      return { title: first.slice(0, pause + 1), body: first.slice(pause + 1).trim() };
    }
    return { title: first || `Step ${i + 1}`, body: "" };
  });
}

export function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
