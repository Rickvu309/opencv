"use client";

import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/use-t";
import { useSaveHandle } from "@/lib/query/satellite";

export function HandlePanel({ initial }: { initial: string }) {
  const { t, m } = useT();
  const save = useSaveHandle();
  const form = useForm({
    defaultValues: { handle: initial },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync(value.handle);
        toast.success(t(m.paper.proof.handleSaved));
      } catch {
        toast.error(t(m.paper.proof.handleInvalid));
      }
    },
  });

  return (
    <form
      className="max-w-md space-y-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="handle">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor="site-handle">{t(m.paper.proof.handleField)}</Label>
            <Input
              id="site-handle"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.target.value.toLowerCase())
              }
            />
            <p className="text-xs text-muted-foreground">
              {t(m.paper.proof.handleHint)} /u/{field.state.value || "…"}
            </p>
          </div>
        )}
      </form.Field>
      <Button type="submit" size="sm" disabled={save.isPending}>
        {t(m.common.save)}
      </Button>
    </form>
  );
}
