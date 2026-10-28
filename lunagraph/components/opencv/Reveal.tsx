import * as React from "react";

/*
 * Copy motion for the landing page.
 * - RevealText: words rise out of a soft blur, staggered.
 * - Reveal: a block (buttons, paragraphs, icons) fades up.
 * Both start once their element scrolls into view, play once, and render settled when
 * `animate` is false or the visitor prefers reduced motion.
 */
const css = `
.rv-w { display: inline-block; opacity: 0; transform: translateY(.38em); filter: blur(6px); }
.rv-on .rv-w { animation: rv-word .8s cubic-bezier(.22,1,.36,1) var(--rv-d, 0ms) both; }
@keyframes rv-word { from { opacity: 0; transform: translateY(.38em); filter: blur(6px); } to { opacity: 1; transform: none; filter: blur(0); } }
.rv-b { opacity: 0; transform: translateY(14px); }
.rv-b.rv-on { animation: rv-block .8s cubic-bezier(.22,1,.36,1) var(--rv-d, 0ms) both; }
@keyframes rv-block { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.rv-static .rv-w, .rv-static.rv-b { opacity: 1; transform: none; filter: none; animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .rv-w, .rv-b { opacity: 1 !important; transform: none !important; filter: none !important; animation: none !important; }
}
`;

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function useInView<T extends Element>(enabled: boolean) {
  const ref = React.useRef<T>(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return [ref, seen] as const;
}

const d = (ms: number) => ({ ["--rv-d" as string]: `${ms}ms` }) as React.CSSProperties;

/** A run of words with its own style, or `mark: true` for the inline opencv Quadrant (it reveals like a word). */
type Part = { text?: string; style?: React.CSSProperties; mark?: boolean };

function Quadrant({ style }: { style: React.CSSProperties }) {
  return (
    <svg className="rv-w" viewBox="0 0 24 24" aria-hidden="true" style={{ width: "0.83em", height: "0.83em", margin: "0 0.04em", verticalAlign: "-0.05em", ...style }}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M2 8A14 14 0 0 1 16 22H2Z" fill="currentColor" />
    </svg>
  );
}

/** Word-by-word reveal. Use `text` for one run, or `parts` for runs with their own colour; "\n" breaks the line. */
export function RevealText({
  text,
  parts,
  as: Tag = "span",
  delay = 0,
  stagger = 45,
  animate = true,
  className,
  style,
}: {
  text?: string;
  parts?: Part[];
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  /** ms before the first word starts. */
  delay?: number;
  /** ms between words. */
  stagger?: number;
  /** Set false to show the settled copy with no motion. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [ref, seen] = useInView<HTMLElement>(animate);
  const runs: Part[] = parts ?? [{ text: text ?? "" }];
  let i = 0;
  const El = Tag as React.ElementType;
  return (
    <El ref={ref} className={[!animate && "rv-static", seen && "rv-on", className].filter(Boolean).join(" ")} style={style}>
      <Styles />
      {runs.map((run, r) =>
        run.mark ? (
          <React.Fragment key={r}>
            {r > 0 && " "}
            <Quadrant style={{ ...run.style, ...d(delay + i++ * stagger) }} />{" "}
          </React.Fragment>
        ) : (run.text ?? "").split("\n").map((line, l) => (
          <React.Fragment key={`${r}-${l}`}>
            {l > 0 && <br />}
            {line.split(/(\s+)/).map((token, t) =>
              /^\s+$/.test(token) || token === "" ? (
                token
              ) : (
                <span key={t} className="rv-w" style={{ ...run.style, ...d(delay + i++ * stagger) }}>
                  {token}
                </span>
              ),
            )}
          </React.Fragment>
        )),
      )}
    </El>
  );
}

/** Block fade-up for anything that isn't a headline. */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  animate = true,
  className,
  style,
  children,
}: {
  as?: "div" | "span" | "p";
  delay?: number;
  /** Set false to show the settled block with no motion. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const [ref, seen] = useInView<HTMLElement>(animate);
  const El = Tag as React.ElementType;
  return (
    <El
      ref={ref}
      className={["rv-b", !animate && "rv-static", seen && "rv-on", className].filter(Boolean).join(" ")}
      style={{ ...d(delay), ...style }}
    >
      <Styles />
      {children}
    </El>
  );
}

export default RevealText;
