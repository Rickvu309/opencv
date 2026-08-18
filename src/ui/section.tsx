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
      <h2 className="text-balance text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">
        {label}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
