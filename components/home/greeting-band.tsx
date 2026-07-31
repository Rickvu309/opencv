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
    <div className="flex flex-col gap-0.5">
      <h1>
        {greeting}, {firstName}. Still steering toward {profile.targetDirectionLabel}.
      </h1>
      <p className="text-sm text-muted-foreground">{pulse}</p>
    </div>
  );
}
