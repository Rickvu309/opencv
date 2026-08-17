import { ImageResponse } from "@vercel/og";
import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";

import { readProofPage } from "@/lib/paper/share";

const size = { width: 1200, height: 630 };

const renderOg = createServerOnlyFn(async (slug: string) => {
  const page = await readProofPage(slug);
  const title = page?.snapshot.title || "Proof";
  const role = page?.snapshot.role ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f6f1e8",
          color: "#1a1714",
          padding: 72,
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Proof
        </div>
        <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>
          {title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
          }}
        >
          <span>{role}</span>
          <span>OpenPath</span>
        </div>
      </div>
    ),
    size,
  );
});

export const Route = createFileRoute("/p/$slug/og")({
  server: {
    handlers: {
      GET: ({ params }) => renderOg(params.slug),
    },
  },
});
