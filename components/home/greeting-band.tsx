import type { Profile } from "@/lib/types";

function timeOfDayGreeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Home's opening line: a single time-aware greeting that references the
 * target direction. The pipeline pulse that used to run as a second prose
 * sentence here now lives as real numbers in StatTiles, right below, so
 * this band stays a one-line hero instead of restating counts as text.
 */
export function GreetingBand({ profile }: { profile: Profile }) {
  const firstName = profile.name.split(" ")[0];
  const greeting = timeOfDayGreeting(new Date().getHours());

  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
      <p className="text-display">
        {greeting}, {firstName}. Still steering toward {profile.targetDirectionLabel}.
      </p>
    </div>
  );
}
