import { buildPipelinePulse } from "@/lib/opportunity-utils";
import type { Opportunity, Profile } from "@/lib/types";

function timeOfDayGreeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Home's opening line: a time-aware greeting that references the target
 * direction, plus a one-line pipeline pulse (interviews in motion, offers
 * waiting on a reply). The proactive surface starts with where things stand,
 * not a blank slate.
 */
export function GreetingBand({ profile, opportunities }: { profile: Profile; opportunities: Opportunity[] }) {
  const firstName = profile.name.split(" ")[0];
  const greeting = timeOfDayGreeting(new Date().getHours());
  const pulse = buildPipelinePulse(opportunities);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card px-5 py-4">
      <p className="text-display">
        {greeting}, {firstName}. Still steering toward {profile.targetDirectionLabel}.
      </p>
      <p className="text-sm text-muted-foreground">{pulse}</p>
    </div>
  );
}
