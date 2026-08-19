import type { ReactNode } from "react";
import { Label } from "./label";

export function Section({
  label,
  children,
  id,
}: {
  label: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-4">
      <h2 className="text-balance text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">
        {label}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-field-row
      className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <Label htmlFor={htmlFor} className="mb-0 max-w-full shrink-0 whitespace-normal sm:max-w-[10rem]">
        {label}
      </Label>
      <div className="min-w-0 w-full sm:max-w-[280px]">{children}</div>
    </div>
  );
}
