import { useEffect, useState } from "react";
import { CopyButton } from "../../copy-button";
import { cn } from "../../cn";
import "./beautiful.css";
import { usePrefersReducedMotion } from "./hooks";

export interface CodeLine {
  tokens: { text: string; tone?: "keyword" | "plain" | "muted" | "string" }[];
}

export interface CodeBlockBeautifulProps {
  filename?: string;
  language?: string;
  lines?: CodeLine[];
}

const DEFAULT_LINES: CodeLine[] = [
  {
    tokens: [
      { text: "export async function ", tone: "keyword" },
      { text: "runBatch", tone: "plain" },
      { text: "() {", tone: "muted" },
    ],
  },
  {
    tokens: [
      { text: "  const ", tone: "keyword" },
      { text: "item = ", tone: "plain" },
      { text: "await ", tone: "keyword" },
      { text: "getItem", tone: "plain" },
      { text: "(", tone: "muted" },
      { text: '"north-batch"', tone: "string" },
      { text: ");", tone: "muted" },
    ],
  },
  {
    tokens: [
      { text: "  const ", tone: "keyword" },
      { text: "base = ", tone: "plain" },
      { text: "await ", tone: "keyword" },
      { text: "store.fetch", tone: "plain" },
      { text: "({ item });", tone: "muted" },
    ],
  },
  {
    tokens: [
      { text: "  return ", tone: "keyword" },
      { text: "schedule(base);", tone: "plain" },
    ],
  },
  {
    tokens: [{ text: "}", tone: "muted" }],
  },
];

export function CodeBlockBeautiful({
  filename = "schedule.ts",
  language = "TypeScript",
  lines = DEFAULT_LINES,
}: CodeBlockBeautifulProps) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(reduced ? lines.length : 0);
  const value = lines.map((line) => line.tokens.map((t) => t.text).join("")).join("\n");

  useEffect(() => {
    if (reduced) {
      setVisible(lines.length);
      return;
    }
    setVisible(0);
    const id = window.setInterval(() => {
      setVisible((n) => {
        if (n >= lines.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [lines.length, reduced]);

  return (
    <div className="w-full max-w-[24rem] overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-[510] text-ink">{filename}</span>
          <span className="text-[11.5px] text-ink-faint">{language}</span>
        </span>
        <CopyButton value={value} className="min-h-6 px-1.5 text-[11.5px]" />
      </div>
      <pre className="min-h-[8.5rem] bg-surface-2 px-3 py-2.5 font-mono text-[11.5px] leading-[1.7]">
        {lines.slice(0, visible).map((line, i) => (
          <div key={i} className={cn("flex", !reduced && "beautiful-fade-up")}>
            <span className="w-5 shrink-0 select-none text-right text-[10.5px] leading-[1.86] text-ink-faint">
              {i + 1}
            </span>
            <span className="pl-2.5 whitespace-pre">
              {line.tokens.map((token, ti) => (
                <span
                  key={`${i}-${ti}`}
                  className={cn(
                    token.tone === "keyword" && "text-ink",
                    token.tone === "plain" && "text-ink-secondary",
                    token.tone === "muted" && "text-ink-faint",
                    token.tone === "string" && "text-status-positive",
                  )}
                >
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}
