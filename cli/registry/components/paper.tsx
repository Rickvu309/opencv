import type { ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from './cn';

/** A4 page on the desk. The page is the product. */
export function PaperPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article className={cn('flex w-[560px] max-w-full flex-col gap-1.5 bg-white px-12 py-12 shadow-[0_0_0_0.5px_var(--color-border),0_8px_24px_rgb(0_0_0/0.04)]', className)} style={{ minHeight: 792 }}>
      {children}
    </article>
  );
}

export function CvName({ children }: { children: ReactNode }) {
  return <h1 className="text-[22px] font-semibold tracking-[-0.4px]">{children}</h1>;
}

export function CvContact({ items }: { items: string[] }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-2">
      {items.map((it, i) => <span key={it} className="flex items-center gap-2">{i > 0 && <span className="h-2.5 w-px bg-border-strong" />}{it}</span>)}
    </p>
  );
}

export function CvSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 flex flex-col gap-2">
      <h2 className="border-b border-border pb-1 text-[10.5px] font-semibold tracking-[0.06em] uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function CvEntry({ title, when, children }: { title: string; when: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[12.5px] font-semibold">{title}</span>
        <span className="shrink-0 text-[11px] text-fg-3">{when}</span>
      </div>
      {children && <ul className="flex flex-col gap-0.5">{children}</ul>}
    </div>
  );
}

/** A bullet leads with what changed because you were there. */
export function CvBullet({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <li className={cn('group relative flex gap-2 rounded-chip px-1.5 py-0.5 text-[12px] leading-normal hover:bg-block-hover', selected && 'bg-selection hover:bg-selection')}>
      <span aria-hidden>•</span>{children}
    </li>
  );
}

/** Paper library card: thumbnail on top, label below. */
export function PaperCard({ title, meta, thumb, href, selected, onClick }: { title: string; meta: string; thumb?: ReactNode; href?: string; selected?: boolean; onClick?: () => void }) {
  const Comp = href ? 'a' : 'button';
  return (
    <Comp href={href} onClick={onClick} className="group flex w-[150px] flex-col gap-2 text-left">
      <span className={cn('flex h-[212px] w-[150px] overflow-hidden rounded-tile bg-white ring-[0.5px] ring-border transition-shadow group-hover:ring-1 group-hover:ring-border-strong group-hover:shadow-[0_6px_16px_rgb(0_0_0/0.1)]', selected && 'ring-[1.5px] ring-focus')}>
        {thumb}
      </span>
      <span className="flex flex-col gap-0.5"><span className="truncate font-medium">{title}</span><span className="text-small text-fg-3">{meta}</span></span>
    </Comp>
  );
}

export function NewPaperCard({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex h-[212px] w-[150px] flex-col items-center justify-center gap-2 rounded-tile bg-subtle font-medium text-fg-2 ring-1 ring-inset ring-border-strong hover:bg-chip">
      <Plus className="size-[18px]" aria-hidden />{label}
    </button>
  );
}

export function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="flex h-8 items-center gap-2 font-medium">
      <ChevronDown className="size-[13px] text-fg-3" aria-hidden />{title}{count != null && <span className="font-normal text-fg-3">{count}</span>}
    </h2>
  );
}

/** A tiny CV preview for thumbnails. */
export function MiniCv({ name = 'Linh Nguyen' }: { name?: string }) {
  return (
    <span className="flex w-full flex-col gap-1 p-3 text-[5px] leading-tight">
      <span className="text-[8px] font-semibold">{name}</span>
      <span className="text-fg-3">linh.nguyen@gmail.com</span>
      {[0, 1, 2].map((s) => (
        <span key={s} className="mt-1 flex flex-col gap-[3px]">
          <span className="h-px bg-border" />
          <span className="h-[3px] w-1/2 rounded bg-fg/70" />
          <span className="h-[2px] w-full rounded bg-border-strong" />
          <span className="h-[2px] w-5/6 rounded bg-border-strong" />
        </span>
      ))}
    </span>
  );
}
