import type { ReactNode } from "react";
import { cn } from "./cn";

export function PageCanvas({
  empty = false,
  children,
  onOpen,
  label,
}: {
  empty?: boolean;
  children?: ReactNode;
  onOpen?: () => void;
  label?: string;
}) {
  const sheetClass = cn(
    "mx-auto block w-full max-w-[210mm] min-h-[297mm] appearance-none rounded-none bg-white p-0 text-left text-black shadow-[var(--shadow-page)]",
    empty && "border border-dashed border-hairline",
    !empty && "px-12 py-12",
    onOpen && "cursor-pointer focus-visible:shadow-[var(--shadow-page),var(--focus-ring)]",
  );

  const sheet = empty ? null : children;

  return (
    <div data-page-canvas className="bg-desk px-5 py-10">
      {onOpen ? (
        <button
          type="button"
          aria-label={label}
          data-page={empty ? "empty" : "filled"}
          onClick={onOpen}
          className={sheetClass}
        >
          {sheet}
        </button>
      ) : (
        <div data-page={empty ? "empty" : "filled"} className={sheetClass}>
          {sheet}
        </div>
      )}
    </div>
  );
}
