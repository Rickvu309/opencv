"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/use-t";

export function HandlePanel({ initial }: { initial: string }) {
  const { t, m } = useT();
  const [handle, setHandle] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="max-w-md space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void fetch("/api/site-handle", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ handle }),
        })
          .then(async (response) => {
            if (!response.ok) {
              toast.error(t(m.paper.proof.handleInvalid));
              return;
            }
            toast.success(t(m.paper.proof.handleSaved));
          })
          .finally(() => setBusy(false));
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="site-handle">{t(m.paper.proof.handleField)}</Label>
        <Input
          id="site-handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value.toLowerCase())}
        />
        <p className="text-xs text-muted-foreground">
          {t(m.paper.proof.handleHint)} /u/{handle || "…"}
        </p>
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {t(m.common.save)}
      </Button>
    </form>
  );
}
