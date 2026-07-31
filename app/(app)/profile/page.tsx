"use client";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function ProfilePage() {
  useCopilotSurface("Profile");
  const { state } = useStore();
  const { profile } = state;

  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" description="What Copilot knows about you, and what it uses when judging fit." />

      <div className="flex flex-col gap-4 p-6">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2>{profile.name}</h2>
              <p className="text-sm text-muted-foreground">
                {profile.headline} · {profile.location}
              </p>
            </div>
            <p className="text-sm text-foreground">{profile.summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3>Strengths</h3>
            <ul className="grid grid-cols-2 gap-2 text-sm text-foreground">
              {profile.strengths.map((strength) => (
                <li key={strength} className="rounded-lg border border-border bg-muted/30 p-2.5">
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3>Experience</h3>
            <div className="flex flex-col gap-3">
              {profile.experience.map((entry, index) => (
                <div key={entry.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {entry.title} · {entry.company}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.start} to {entry.end}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{entry.summary}</p>
                  {index < profile.experience.length - 1 ? <Separator className="mt-3" /> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <h3>Preferences and direction</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd className="text-foreground">{profile.preferences.location}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role types</dt>
                <dd className="text-foreground">{profile.preferences.roleTypes.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Compensation</dt>
                <dd className="text-foreground">{profile.preferences.compensationNote}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Target direction</dt>
                <dd className="text-foreground">{profile.targetDirection}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3>What Copilot uses</h3>
              <CopilotTag />
            </div>
            <p className="text-sm text-muted-foreground">
              Fit judgments on opportunities draw mainly on your target direction, strengths, and experience
              entries, especially the Fintra explainability work, which is your strongest evidence for AI-forward
              roles right now.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
