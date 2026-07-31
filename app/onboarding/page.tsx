"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export default function OnboardingPage() {
  const router = useRouter();
  const { markOnboarded } = useStore();

  function continueToHome() {
    markOnboarded();
    router.push("/home");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-6">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            OP
          </span>
          <h1>Welcome to OpenPath</h1>
          <p className="text-sm text-muted-foreground">
            Hi Mai. OpenPath keeps your opportunities, career memory, and direction in one place, with Copilot
            helping you decide what deserves attention next. Nothing here applies itself: Copilot drafts and
            suggests, you always decide.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={continueToHome} className="gap-2">
            <Sparkles className="size-4" />
            Start setup
          </Button>
          <Button variant="ghost" onClick={continueToHome}>
            Skip for now
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Setup walks through your role, target direction, and goals. This prototype seeds that context for you
          either way.
        </p>
      </div>
    </div>
  );
}
