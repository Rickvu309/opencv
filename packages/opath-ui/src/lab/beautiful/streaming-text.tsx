import { ChevronDown, Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../collapsible";
import "./beautiful.css";
import { usePrefersReducedMotion } from "./hooks";

export interface StreamingSource {
  title: string;
  host: string;
  href: string;
}

export interface StreamingTextProps {
  text?: string;
  sources?: StreamingSource[];
  followUps?: string[];
}

const DEFAULT_TEXT =
  "North batch is the fastest-growing line this month — volume is up 23% versus last period, with stronger weekend peaks.";

const DEFAULT_SOURCES: StreamingSource[] = [
  { title: "Sales index", host: "records.example", href: "#" },
  { title: "Trend report", host: "trends.example", href: "#" },
  { title: "Market basket", host: "basket.example", href: "#" },
];

const DEFAULT_FOLLOW_UPS = [
  "Which lines sell best in winter",
  "Compare margin between the two formats",
];

export function StreamingText({
  text = DEFAULT_TEXT,
  sources = DEFAULT_SOURCES,
  followUps = DEFAULT_FOLLOW_UPS,
}: StreamingTextProps) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(" ");
  const [count, setCount] = useState(reduced ? words.length : 0);
  const done = count >= words.length;

  useEffect(() => {
    if (reduced) {
      setCount(words.length);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((n) => {
        if (n >= words.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 48);
    return () => window.clearInterval(id);
  }, [reduced, text, words.length]);

  return (
    <div className="min-h-[15.5rem] w-full max-w-[24rem]">
      <p className="text-[13px] leading-relaxed text-ink">
        {words.slice(0, count).map((word, i) => (
          <span key={`${word}-${i}`} className={cn("inline", !reduced && "beautiful-stream-in")}>
            {word}
            {i < count - 1 ? " " : ""}
          </span>
        ))}
        {!done ? (
          <span
            className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full bg-ink"
            aria-hidden="true"
          />
        ) : null}
      </p>
      <div
        className={cn(
          "mt-2 flex items-center gap-0.5 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]",
          done ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <IconAction label="Copy">
          <Copy className="size-3.5" />
        </IconAction>
        <IconAction label="Retry">
          <RefreshCw className="size-3.5" />
        </IconAction>
        <IconAction label="Helpful">
          <ThumbsUp className="size-3.5" />
        </IconAction>
        <IconAction label="Not helpful">
          <ThumbsDown className="size-3.5" />
        </IconAction>
      </div>
      <Collapsible className="mt-2">
        <CollapsibleTrigger className="flex min-h-8 items-center gap-1 text-[12.5px] text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink">
          <ChevronDown className="size-3" aria-hidden="true" />
          {sources.length} sources
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-1 flex flex-col gap-1">
            {sources.map((source) => (
              <li key={source.host}>
                <a
                  href={source.href}
                  className="flex items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1 text-[12.5px] hover:bg-surface-2"
                >
                  <span className="font-[510] text-ink">{source.title}</span>
                  <span className="text-ink-faint">{source.host}</span>
                </a>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      <div className="mt-3">
        <p className="mb-1.5 text-[12px] text-ink-muted">Follow-ups</p>
        <div className="flex flex-col gap-1">
          {followUps.map((item) => (
            <button
              key={item}
              type="button"
              className="w-fit rounded-[var(--radius-pill)] border border-hairline px-2.5 py-1 text-left text-[12.5px] text-ink transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IconAction({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-6 items-center justify-center rounded-[var(--radius-control)] text-ink-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-ink-secondary"
    >
      {children}
    </button>
  );
}
