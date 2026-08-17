import type { useNavigate } from "@tanstack/react-router";
import type { AppOpenResult } from "@/features/coach/model";

type Navigate = ReturnType<typeof useNavigate>;

export async function navigateToOpen(navigate: Navigate, result: AppOpenResult) {
  if (!result.ok) return;
  switch (result.place) {
    case "chat":
      await navigate({ to: "/coach", search: { thread: undefined } });
      return;
    case "paper":
      if (result.paperId) {
        await navigate({ to: "/paper/$paperId", params: { paperId: result.paperId } });
      } else {
        await navigate({ to: "/paper" });
      }
      return;
    case "proof":
      if (result.proofId) {
        await navigate({ to: "/proof/$proofId", params: { proofId: result.proofId } });
      } else {
        await navigate({ to: "/proof" });
      }
      return;
    case "pitch":
      await navigate({ to: "/pitch" });
      return;
    case "search":
      await navigate({ to: "/search" });
      return;
    case "apply":
      await navigate({ to: "/applications" });
      return;
    case "profile":
      await navigate({ to: "/profile" });
      return;
    case "settings":
      await navigate({ to: "/settings" });
      return;
  }
}
