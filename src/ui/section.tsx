import type { ReactNode } from "react";

export function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-[18px] font-medium leading-[1.5]">{label}</h2>
      {children}
    </section>
  );
}
