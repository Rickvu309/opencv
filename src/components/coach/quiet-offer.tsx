"use client";

import { Button } from "@/components/ui/button";
import { useCoach } from "@/components/coach/provider";

/**
 * A modest offer to sharpen or draft what is already on the page.
 *
 * Trailing text action, same politeness as Pitch: writing is the work; this is
 * help if they want it. Sends through the open thread.
 */
export function QuietCoachOffer({
  label,
  prompt,
}: {
  label: string;
  prompt: string;
}) {
  const thread = useCoach();

  return (
    <Button
      variant="ghost"
      size="xs"
      className="font-normal text-muted-foreground hover:text-foreground"
      disabled={thread.busy}
      onClick={() => thread.send(prompt)}
    >
      {label}
    </Button>
  );
}
