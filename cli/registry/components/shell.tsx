import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, History, Menu as MenuIcon, MessageCircle, Search, Settings, SquarePen, X } from 'lucide-react';
import { cn } from './cn';
import { Mark } from './brand';
import { Avatar } from './display';
import { IconButton } from './button';

/** Renders links. Pass your router's link (for example a wrapper around react-router's Link). */
export type LinkLike = ComponentType<{ href: string; className?: string; children: ReactNode; 'aria-current'?: 'page' }>;
const PlainLink: LinkLike = ({ href, ...rest }) => <a href={href} {...rest} />;

export interface NavEntry { label: string; href: string; icon: ReactNode; count?: number }
export interface NavSection { title?: string; items: NavEntry[] }

export function NavItem({ item, active, link: L = PlainLink }: { item: NavEntry; active?: boolean; link?: LinkLike }) {
  return (
    <L
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-7 items-center gap-2 rounded-row px-2 text-body transition-colors [&>svg]:size-3.5 [&>svg]:shrink-0',
        active ? 'bg-active font-medium text-fg' : 'text-fg-2 hover:bg-hover',
      )}
    >
      {item.icon}
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && <span className="text-small text-fg-3">{item.count}</span>}
    </L>
  );
}

/** Workspace row, nav sections, account row. Width 244. */
export function Sidebar({ sections, activeHref, user, link, onSearch, onCompose, settingsHref = '/settings' }: {
  sections: NavSection[]; activeHref: string; user: { name: string; initials: string }; link?: LinkLike;
  onSearch?: () => void; onCompose?: () => void; settingsHref?: string;
}) {
  const L = link ?? PlainLink;
  return (
    <aside className="flex w-[244px] shrink-0 flex-col px-2.5 pt-2.5 pb-3" aria-label="Main">
      <div className="mb-1 flex h-8 items-center gap-2 px-1.5">
        <Mark size={18} />
        <span className="flex-1 text-[14px] font-semibold tracking-[-0.3px]">opencv</span>
        <IconButton label="Search" size={24} onClick={onSearch}><Search /></IconButton>
        <IconButton label="New" size={24} onClick={onCompose} className="bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.08)]"><SquarePen /></IconButton>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto pt-1">
        {sections.map((s, i) => (
          <div key={i} className="flex flex-col gap-px">
            {s.title && (
              <div className="flex h-6 items-center gap-1 px-2 text-small text-fg-3">
                {s.title}<ChevronDown className="size-3" aria-hidden />
              </div>
            )}
            {s.items.map((it) => <NavItem key={it.href + it.label} item={it} active={activeHref === it.href || (it.href !== '/' && activeHref.startsWith(it.href + '/'))} link={link} />)}
          </div>
        ))}
      </nav>
      <div className="flex h-8 items-center gap-2 px-1.5">
        <Avatar initials={user.initials} size={20} />
        <span className="flex-1 truncate text-body">{user.name}</span>
        <L href={settingsHref} className="inline-flex size-6 items-center justify-center rounded-row text-fg-2 hover:bg-hover" aria-current={undefined}>
          <Settings className="size-3.5" aria-label="Settings" />
        </L>
      </div>
    </aside>
  );
}

/** Next steps on the left of Coach in the bottom bar. Two at most. */
export function Dock({ suggestions = [], onCoach, onHistory }: { suggestions?: string[]; onCoach?: () => void; onHistory?: () => void }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-end gap-1 pr-2 pl-2">
      {suggestions.slice(0, 2).map((s) => (
        <button key={s} onClick={onCoach} className="h-7 rounded-row px-2.5 text-small text-fg-2 hover:bg-hover">{s}</button>
      ))}
      <button onClick={onCoach} className="inline-flex h-7 items-center gap-1.5 rounded-row px-2.5 text-small font-medium text-fg hover:bg-hover">
        <MessageCircle className="size-3.5" aria-hidden />Coach
      </button>
      <IconButton label="History" size={28} onClick={onHistory}><History /></IconButton>
    </div>
  );
}

/** Sidebar, main panel (r8, inset 8) and the bottom dock. Every app page lives in the main panel.
 *  Below 768px the sidebar becomes a drawer behind a menu button. */
export function AppShell({ sidebar, children, dock, panel }: { sidebar: ReactNode; children: ReactNode; dock?: ReactNode; panel?: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  return (
    <div className="flex h-dvh min-h-[560px] flex-col bg-sidebar md:flex-row">
      <div className="flex h-11 shrink-0 items-center gap-2 px-3 md:hidden">
        <IconButton label="Menu" onClick={() => setOpen(true)}><MenuIcon /></IconButton>
        <Mark size={16} /><span className="text-[14px] font-semibold tracking-[-0.3px]">opencv</span>
      </div>
      <div className="hidden md:flex">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden" onClick={() => setOpen(false)}>
          <div className="flex h-full bg-sidebar shadow-dialog" onClick={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>{sidebar}</div>
          <button aria-label="Close menu" className="m-2 inline-flex size-8 items-center justify-center rounded-btn bg-surface text-fg-2"><X className="size-4" /></button>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 md:pt-2 md:pb-0 md:pl-0">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tile bg-surface shadow-[0_0_0_0.5px_var(--color-border)]">{children}</main>
        <div className="hidden md:block">{dock ?? <Dock />}</div>
      </div>
      {panel}
    </div>
  );
}

/** h52, title 13/500, actions on the right. */
export function PageHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex h-[52px] shrink-0 items-center gap-2 border-b-[0.5px] border-border pr-4 pl-5', className)}>
      <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-body font-medium">{title}</h1>
      {children}
    </header>
  );
}

export interface ViewTab { label: string; href: string; icon: ReactNode }

/** View tabs on the left, filter and display on the right. h44. */
export function Toolbar({ tabs, active, link: L = PlainLink, children }: { tabs: ViewTab[]; active: string; link?: LinkLike; children?: ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5 border-b-[0.5px] border-border pr-3 pl-4">
      <nav className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" aria-label="Views">
        {tabs.map((t) => (
          <L key={t.href} href={t.href} aria-current={t.href === active ? 'page' : undefined}
            className={cn('inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-[9px] text-[12.5px] [&>svg]:size-[13px]', t.href === active ? 'bg-active font-medium text-fg' : 'text-fg-2 ring-1 ring-inset ring-border hover:bg-subtle')}>
            {t.icon}{t.label}
          </L>
        ))}
      </nav>
      {children}
    </div>
  );
}

/** "Apply › [icon] Associate PM intern" with next and previous. */
export function DetailHeader({ parent, parentHref, icon, title, position, onPrev, onNext, link: L = PlainLink, children }: {
  parent: string; parentHref: string; icon?: ReactNode; title: string; position?: string; onPrev?: () => void; onNext?: () => void; link?: LinkLike; children?: ReactNode;
}) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b-[0.5px] border-border pr-4 pl-5">
      <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-body" aria-label="Breadcrumb">
        <L href={parentHref} className="text-fg-2 hover:text-fg">{parent}</L>
        <ChevronRight className="size-3.5 text-fg-3" aria-hidden />
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-medium [&>svg]:size-3.5">{icon}{title}</span>
      </nav>
      {position && <span className="mr-1 text-small text-fg-3">{position}</span>}
      {onPrev && <IconButton label="Previous" size={24} onClick={onPrev}><ChevronUp /></IconButton>}
      {onNext && <IconButton label="Next" size={24} onClick={onNext}><ChevronDown /></IconButton>}
      {children}
    </header>
  );
}

export function BackLink({ href, children, link: L = PlainLink }: { href: string; children: ReactNode; link?: LinkLike }) {
  return (
    <L href={href} className="flex h-7 items-center gap-2 rounded-row px-2 text-body text-fg-2 hover:bg-hover">
      <ChevronLeft className="size-3.5" aria-hidden />{children}
    </L>
  );
}
