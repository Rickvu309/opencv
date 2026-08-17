import { createFileRoute } from "@tanstack/react-router";
import { CoachScreen } from "@/features/coach/screens/coach";

export type CoachSearch = {
  thread?: string;
};

export const Route = createFileRoute("/_app/coach")({
  validateSearch: (search: Record<string, unknown>): CoachSearch => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  component: CoachPage,
});

function CoachPage() {
  const { thread } = Route.useSearch();
  return <CoachScreen threadId={thread} />;
}
