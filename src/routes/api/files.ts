import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/core/auth/session";
import { withClient } from "@/core/db/client.server";

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await requireUser();
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return new Response("missing id", { status: 400 });
        const { rows } = await withClient((c) =>
          c.query(`select filename, mime, bytes from files where id=$1 and user_id=$2`, [
            id,
            user.id,
          ]),
        );
        const file = rows[0];
        if (!file) return new Response("not found", { status: 404 });
        return new Response(file.bytes, {
          headers: {
            "content-type": file.mime,
            "content-disposition": `inline; filename="${file.filename}"`,
          },
        });
      },
    },
  },
});
