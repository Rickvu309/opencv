import type { ReactNode } from 'react';
import { Calendar, ChevronDown, ChevronRight, MapPin, Plus, Check, Building2 } from 'lucide-react';
import { cn } from './cn';
import { StageIcon, STAGE_LABEL, type Stage } from './brand';

export type Priority = 'none' | 'low' | 'medium' | 'high';

export interface Job {
  id: string;
  role: string;
  company: string;
  stage: Stage;
  /** Lucide icon for the company tile. Company tiles stay dark, never colored. */
  logo?: ReactNode;
  priority?: Priority;
  location?: string;
  date?: string;
  interview?: string;
}

/** Signal bars. Low 1, medium 2, high 3. */
export function PriorityBars({ level = 'medium' }: { level?: Priority }) {
  const n = { none: 0, low: 1, medium: 2, high: 3 }[level];
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" role="img" aria-label={`${level} priority`}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1 + i * 4} y={8 - i * 3} width="2.4" height={3 + i * 3} rx="0.8" fill={i < n ? 'var(--color-fg-2)' : 'var(--color-border-strong)'} />
      ))}
    </svg>
  );
}

export function CompanyTile({ icon, size = 28 }: { icon?: ReactNode; size?: 20 | 28 }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center bg-surface text-fg ring-[0.5px] ring-border', size === 28 ? 'size-7 rounded-row [&_svg]:size-3.5' : 'size-5 rounded-[5px] [&_svg]:size-[11px]')}>
      {icon ?? <Building2 />}
    </span>
  );
}

function PropChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-[22px] items-center gap-1 rounded-row px-1.5 text-small text-fg-2 ring-[0.5px] ring-inset ring-border [&_svg]:size-3">{children}</span>;
}

/** Board card. Job title first, company second. No tags; the stage lives in the lane. */
export function JobCard({ job, selected, onClick, className }: { job: Job; selected?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-tile bg-surface p-3 text-left ring-[0.5px] ring-border transition-shadow hover:ring-1 hover:ring-border-strong',
        selected && 'ring-[1.5px] ring-focus hover:ring-focus',
        className,
      )}
    >
      <span className="flex items-start gap-2.5">
        <CompanyTile icon={job.logo} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{job.role}</span>
          <span className="truncate text-small text-fg-2">{job.company}</span>
        </span>
      </span>
      {job.interview && (
        <span className="ml-[38px] inline-flex h-[22px] w-fit items-center gap-1.5 rounded-row bg-subtle px-2 text-small font-medium">
          <Calendar className="size-3 text-indigo" aria-hidden />{job.interview}
        </span>
      )}
      <span className="flex items-center gap-1.5 pl-[38px]">
        <PropChip><PriorityBars level={job.priority} /></PropChip>
        {job.location && <PropChip><MapPin className="text-info" aria-hidden />{job.location}</PropChip>}
        <span className="flex-1" />
        {job.date && <span className="text-small text-fg-3">{job.date}</span>}
      </span>
    </button>
  );
}

/** List view row: stage, company tile, job title, company, interview, date. */
export function JobRow({ job, selected, onClick }: { job: Job; selected?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex h-10 w-full items-center gap-2.5 rounded-row px-4 text-left hover:bg-subtle', selected && 'bg-active hover:bg-active')}>
      <StageIcon stage={job.stage} />
      <CompanyTile icon={job.logo} size={20} />
      <span className="font-medium">{job.role}</span>
      <span className="flex-1 truncate text-fg-3">{job.company}</span>
      {job.interview && (
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-[5px] bg-subtle px-[7px] text-small font-medium">
          <Calendar className="size-3 text-indigo" aria-hidden />{job.interview}
        </span>
      )}
      {job.date && <span className="w-14 text-right text-small text-fg-3">{job.date}</span>}
    </button>
  );
}

/** Groups list rows by stage. Collapsed groups keep their count. */
export function ListGroup({ stage, count, open, onToggle, onAdd, children }: { stage: Stage; count: number; open: boolean; onToggle: () => void; onAdd?: () => void; children?: ReactNode }) {
  return (
    <section>
      <div className="flex h-9 items-center gap-2 rounded-row bg-subtle px-3">
        <button onClick={onToggle} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="size-3.5 text-fg-3" /> : <ChevronRight className="size-3.5 text-fg-3" />}
          <StageIcon stage={stage} />
          <span className="font-medium">{STAGE_LABEL[stage]}</span>
          <span className="text-fg-3">{count}</span>
        </button>
        {onAdd && <button onClick={onAdd} aria-label={`Add to ${STAGE_LABEL[stage]}`} className="text-fg-3 hover:text-fg"><Plus className="size-3.5" /></button>}
      </div>
      {open && <div className="flex flex-col py-1">{children}</div>}
    </section>
  );
}

/** A stage column. The lane stays light, the cards carry the content. */
export function BoardLane({ stage, count, onAdd, dropTarget, children }: { stage: Stage; count: number; onAdd?: () => void; dropTarget?: boolean; children?: ReactNode }) {
  return (
    <section className={cn('flex w-[244px] shrink-0 flex-col gap-2 rounded-row p-2', dropTarget ? 'bg-[#EEF1FB] ring-[1.5px] ring-focus' : 'bg-[#FAFAFA]')} aria-label={STAGE_LABEL[stage]}>
      <div className="flex h-7 items-center gap-2 px-1">
        <StageIcon stage={stage} />
        <span className="font-medium">{STAGE_LABEL[stage]}</span>
        <span className="flex-1 text-fg-3">{count}</span>
        {onAdd && <button onClick={onAdd} aria-label={`Add to ${STAGE_LABEL[stage]}`} className="text-fg-3 hover:text-fg"><Plus className="size-3.5" /></button>}
      </div>
      {count === 0 && !children ? (
        <div className="flex h-[72px] items-center justify-center rounded-tile text-small text-fg-3 ring-1 ring-inset ring-border">Drop a job here</div>
      ) : children}
    </section>
  );
}

/** Rows in the detail rail. Empty properties read as an action. */
export function Property({ icon, children, empty, onClick }: { icon: ReactNode; children: ReactNode; empty?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex h-8 w-full items-center gap-[9px] rounded-row px-2 text-left hover:bg-subtle [&>svg]:size-3.5', empty ? 'text-fg-3' : 'text-fg')}>
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <div className="flex h-7 items-center gap-1 px-2 text-small text-fg-3">{title}<ChevronDown className="size-3" aria-hidden /></div>
      {children}
    </div>
  );
}

/** Interview prep and next steps. */
export function ChecklistItem({ done, onToggle, children }: { done: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <label className="group flex h-8 cursor-pointer items-center gap-2.5 rounded-row px-2 hover:bg-subtle">
      <button role="checkbox" aria-checked={done} onClick={onToggle}
        className={cn('inline-flex size-[15px] shrink-0 items-center justify-center rounded-full', done ? 'bg-stage-offer' : 'ring-[1.2px] ring-inset ring-border-strong')}>
        {done && <Check className="size-2.5 text-white" strokeWidth={3} />}
      </button>
      <span className={cn(done && 'text-fg-3 line-through')}>{children}</span>
    </label>
  );
}

export function ActivityItem({ icon, children, when }: { icon: ReactNode; children: ReactNode; when: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2.5">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-fg-3 [&_svg]:size-[11px]">{icon}</span>
      <span className="text-fg-2">{children}</span>
      <span className="text-fg-3">{when}</span>
    </div>
  );
}
