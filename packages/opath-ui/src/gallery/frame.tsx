import type { ReactNode } from "react";

export function GalleryPage({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-1 py-2 text-left">
      <h2 className="text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">{title}</h2>
      {note ? <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function GallerySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="mb-3 text-[13px] font-[510] text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

export function TokenRow({
  token,
  role,
  swatch,
}: {
  token: string;
  role: string;
  swatch?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline py-2 last:border-b-0">
      {swatch}
      <div className="min-w-0">
        <p className="font-mono text-[12px] leading-[1.5]">{token}</p>
        <p className="text-[13px] leading-[1.5] text-ink-muted">{role}</p>
      </div>
    </div>
  );
}

export function ColorSwatch({ token }: { token: string }) {
  return (
    <div
      className="size-10 shrink-0 rounded-[var(--radius-control)] border border-hairline"
      style={{ background: `var(${token})` }}
      aria-hidden="true"
    />
  );
}
