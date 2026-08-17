"use client";

import * as React from "react";
import { FileUp, X } from "lucide-react";

import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/**
 * A CV the user already has, kept as a filename on the profile vault.
 *
 * Same pointer the profile screen already stores: OpenPath does not parse the
 * file. The drop exists so they do not have to type the name.
 */
export function ResumeDrop({
  name,
  label,
  onPick,
  onClear,
}: {
  name: string | null;
  label: string;
  onPick: (filename: string) => void;
  onClear: () => void;
}) {
  const { t, m } = useT();
  const [over, setOver] = React.useState(false);

  function take(files: FileList | null) {
    const file = files?.[0];
    if (file) onPick(file.name);
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center",
        name || over ? "border-foreground bg-foreground/4" : "hover:bg-foreground/4",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        take(event.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept=".pdf,.doc,.docx,application/pdf"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      {name ? (
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileUp className="size-4 shrink-0" />
          <span className="max-w-[14rem] truncate">{name}</span>
          <button
            type="button"
            aria-label={t(m.onboarding.removeFile)}
            className="rounded-md p-0.5 hover:bg-foreground/10"
            onClick={(event) => {
              event.preventDefault();
              onClear();
            }}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ) : (
        <>
          <FileUp className="size-4 text-muted-foreground" />
          <span className="mt-2 text-sm text-muted-foreground">{label}</span>
        </>
      )}
    </label>
  );
}
