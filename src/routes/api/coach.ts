import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "@/core/auth/session";
import { coachTurn } from "@/features/coach/agent/turn";
import { executeCommand } from "@/core/commands/bus";

export const Route = createFileRoute("/api/coach")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await currentUser();
        if (!user) return new Response("sign in needed", { status: 401 });
        const body = (await request.json()) as {
          conversationId?: string;
          text: string;
          screen?: string;
          grants?: string[];
          role?: "cheap" | "chat" | "drafting";
          excerpt?: { text: string; label?: string };
        };
        let conversationId = body.conversationId;
        if (!conversationId) {
          const created = await executeCommand<{ id: string }>(
            "conversation.start",
            { title: body.text.slice(0, 40) },
            { kind: "user", userId: user.id },
          );
          conversationId = created.result.id;
        }
        return coachTurn({
          userId: user.id,
          conversationId,
          text: body.text,
          screen: body.screen,
          grants: body.grants,
          role: body.role,
          excerpt: body.excerpt,
        });
      },
    },
  },
});
