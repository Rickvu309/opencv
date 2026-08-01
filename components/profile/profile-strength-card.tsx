import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ProfileStrengthPrompt } from "@/lib/profile-utils";

interface ProfileStrengthCardProps {
  percent: number;
  prompts: ProfileStrengthPrompt[];
}

/**
 * Percent meter plus the 2 most specific improvement prompts, computed live
 * off the current profile so finishing an edit on a prompted section moves
 * the meter without a separate save step.
 */
export function ProfileStrengthCard({ percent, prompts }: ProfileStrengthCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Profile strength</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Complete</span>
            <span className="font-medium text-foreground">{percent}%</span>
          </div>
          <Progress value={percent} />
        </div>
        {prompts.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {prompts.map((prompt) => (
              <li key={prompt.id} className="rounded-lg border border-dashed border-border px-2.5 py-1.5">
                {prompt.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Every strength check is passing.</p>
        )}
        <Link
          href="/proof?context=profile"
          className="flex w-fit items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          <ShieldCheck className="size-3.5" />
          Verify claims
        </Link>
      </CardContent>
    </Card>
  );
}
