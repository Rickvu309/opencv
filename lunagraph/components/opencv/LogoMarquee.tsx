import * as React from "react";

const LOGOS = [
  { slug: "stripe", name: "Stripe" },
  { slug: "figma", name: "Figma" },
  { slug: "notion", name: "Notion" },
  { slug: "vercel", name: "Vercel" },
  { slug: "airbnb", name: "Airbnb" },
  { slug: "shopify", name: "Shopify" },
  { slug: "coinbase", name: "Coinbase" },
];

const css = `
.lm-track { display: flex; width: max-content; animation: lm-scroll 32s linear infinite; }
.lm-root:hover .lm-track { animation-play-state: paused; }
@keyframes lm-scroll { to { transform: translateX(-50%); } }
.lm-static .lm-track { animation: none; }
@media (prefers-reduced-motion: reduce) { .lm-track { animation: none !important; } }
`;

/** Brand marks (Simple Icons, one muted colour) with their names, scrolling in an endless loop with faded edges. */
export function LogoMarquee({
  color = "#8A8A88",
  animate = true,
  className,
  style,
}: {
  /** One colour for every mark and name. */
  color?: string;
  /** Set false to show a still row. */
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hex = color.replace("#", "");
  const fade = "linear-gradient(90deg, transparent 0, #000 96px, #000 calc(100% - 96px), transparent 100%)";
  return (
    <div
      className={["lm-root", !animate && "lm-static", className].filter(Boolean).join(" ")}
      style={{ width: 1280, overflow: "hidden", WebkitMaskImage: fade, maskImage: fade, ...style }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ul className="lm-track" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {[0, 1].map((copy) =>
          LOGOS.map((logo) => (
            <li
              key={`${copy}-${logo.slug}`}
              aria-hidden={copy === 1 ? true : undefined}
              style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 72, flexShrink: 0 }}
            >
              {logo.slug === "coinbase" ? (
                // Simple Icons ships Coinbase as its wordmark, centred in a square; scale it up and crop to the word.
                <span style={{ display: "block", width: 100, height: 22, overflow: "hidden" }}>
                  <img src={`https://cdn.simpleicons.org/coinbase/${hex}`} alt={logo.name} width={100} height={100} style={{ display: "block", marginTop: -39 }} />
                </span>
              ) : (
                <>
                  <img src={`https://cdn.simpleicons.org/${logo.slug}/${hex}`} alt="" width={22} height={22} style={{ display: "block" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color, whiteSpace: "nowrap" }}>
                    {logo.name}
                  </span>
                </>
              )}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}

export default LogoMarquee;
