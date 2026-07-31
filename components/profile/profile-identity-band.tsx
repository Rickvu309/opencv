import { MapPin, Target } from "lucide-react";

import { Chip } from "@/components/shared/chip";
import { Progress } from "@/components/ui/progress";
import type { Profile } from "@/lib/types";

interface ProfileIdentityBandProps {
  profile: Profile;
  strengthPercent: number;
}

/**
 * Top band of the Profile page: who this is, where they are headed, and how
 * complete the working asset is. Read-only, the four cards below are where
 * profile content actually gets edited.
 */
export function ProfileIdentityBand({ profile, strengthPercent }: ProfileIdentityBandProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border bg-background px-6 py-5">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold text-foreground">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">{profile.headline}</p>
          <p className="text-xs text-muted-foreground">
            {profile.currentRole} · {profile.experienceLevel}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              label={profile.location}
              icon={<MapPin className="size-3" />}
              className="bg-muted text-muted-foreground"
            />
            <Chip
              label={profile.targetDirectionLabel}
              icon={<Target className="size-3" />}
              className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            />
          </div>
        </div>

        <div className="flex w-56 shrink-0 flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Profile strength</span>
            <span className="font-medium text-foreground">{strengthPercent}%</span>
          </div>
          <Progress value={strengthPercent} />
        </div>
      </div>
    </div>
  );
}
