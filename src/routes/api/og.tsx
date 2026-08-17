import { ImageResponse } from "@vercel/og";
import { createFileRoute } from "@tanstack/react-router";
import { getProofPageFn } from "@/features/share/queries";

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const slug = new URL(request.url).searchParams.get("slug") ?? "";
        const page = await getProofPageFn({ data: { slug } });
        const title =
          (page?.content as { title?: string } | undefined)?.title ?? "OpenPath Proof";
        return new ImageResponse(
          (
            <div
              style={{
                fontSize: 48,
                background: "white",
                color: "#141413",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                padding: 48,
              }}
            >
              {title}
            </div>
          ),
          { width: 1200, height: 630 },
        );
      },
    },
  },
});
