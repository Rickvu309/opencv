import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Check, ChevronDown, CornerDownRight, Copy, FileText, Leaf, Lock, Plus, RotateCcw, Rocket, ThumbsDown, ThumbsUp, Zap, Lightbulb, Hourglass } from 'lucide-react';
import { cn } from './cn';
import { Steps, type Step } from './feedback';

export type CoachModel = 'free' | 'light' | 'max';
const MODELS: { value: CoachModel; label: string; icon: ReactNode; pro?: boolean }[] = [
  { value: 'free', label: 'Free', icon: <Leaf /> },
  { value: 'light', label: 'Light', icon: <Zap />, pro: true },
  { value: 'max', label: 'Max', icon: <Rocket />, pro: true },
];

/** The "Free ⌄" model pill. Never remove it. Light and Max need Pro. */
export function ModelPill({ value, onChange, isPro }: { value: CoachModel; onChange: (m: CoachModel) => void; isPro?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const cur = MODELS.find((m) => m.value === value)!;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex h-[30px] items-center gap-[5px] rounded-full px-2 font-medium text-fg-2 hover:bg-subtle [&_svg]:size-3.5">
        {cur.icon}{cur.label}<ChevronDown className="!size-3 text-fg-3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full z-30 mb-1 w-44 rounded-tile bg-surface p-1 shadow-pop ring-[0.5px] ring-border">
          {MODELS.map((m) => {
            const locked = m.pro && !isPro;
            return (
              <button key={m.value} role="menuitemradio" aria-checked={m.value === value} disabled={locked}
                onClick={() => { onChange(m.value); setOpen(false); }}
                className="flex h-[30px] w-full items-center gap-2 rounded-row px-2 text-left hover:bg-subtle disabled:hover:bg-transparent [&>svg]:size-3.5 [&>svg]:text-fg-2">
                {m.icon}<span className="flex-1">{m.label}</span>
                {locked ? <span className="inline-flex items-center gap-1 rounded-chip px-1 text-[11px] text-fg-3 ring-1 ring-inset ring-border"><Lock className="size-2.5" />Pro</span>
                  : m.value === value && <Check className="size-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Where every Coach request starts. Stays usable while Coach works. */
export function Composer({ placeholder = 'Ask Coach anything', onSend, working, context, model, onModel, isPro, limit, className }: {
  placeholder?: string; onSend?: (text: string) => void; working?: boolean; context?: string;
  model: CoachModel; onModel: (m: CoachModel) => void; isPro?: boolean;
  /** At the Free limit: shows why and how to continue. Paper and Apply keep working. */
  limit?: { resetsAt: string; onUpgrade: () => void };
  className?: string;
}) {
  const [text, setText] = useState('');
  const send = () => { if (!text.trim() || limit) return; onSend?.(text.trim()); setText(''); };
  return (
    <div className={cn('w-full max-w-[720px] overflow-hidden rounded-panel bg-surface shadow-[0_2px_8px_rgb(0_0_0/0.04)] ring-1 ring-border', className)}>
      {limit && (
        <div className="flex items-center gap-3 border-b-[0.5px] border-border bg-subtle px-4 py-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-row bg-surface ring-[0.5px] ring-border"><Hourglass className="size-3.5 text-fg-2" aria-hidden /></span>
          <div className="flex flex-1 flex-col">
            <span className="font-medium">You've reached today's Free limit</span>
            <span className="text-small text-fg-2">Resets at {limit.resetsAt}. Pro has unlimited Coach chats.</span>
          </div>
          <button onClick={limit.onUpgrade} className="glow-button h-7 rounded-row px-2.5 text-body font-medium text-[#1B1B1F] shadow-glow ring-1 ring-inset ring-white/70">Upgrade</button>
        </div>
      )}
      <textarea
        value={text}
        disabled={!!limit}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={limit ? `Coach is back at ${limit.resetsAt}` : working ? 'Coach is working. You can keep typing.' : placeholder}
        aria-label="Message Coach"
        rows={2}
        className="block w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] outline-none disabled:cursor-not-allowed"
      />
      <div className="flex items-center gap-1.5 px-3 pb-3">
        <button aria-label="Add context" className="inline-flex size-[30px] items-center justify-center rounded-full text-fg-2 ring-1 ring-inset ring-border hover:bg-subtle"><Plus className="size-[15px]" /></button>
        {context && <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-subtle pr-2.5 pl-2 text-small text-fg-2"><FileText className="size-[13px]" />{context}</span>}
        <span className="flex-1" />
        <ModelPill value={model} onChange={onModel} isPro={isPro} />
        <button onClick={send} aria-label={working ? 'Stop' : 'Send'} disabled={!!limit || (!text.trim() && !working)}
          className={cn('inline-flex size-8 items-center justify-center rounded-full transition-colors', text.trim() || working ? 'bg-fg text-white' : 'bg-chip text-fg-3')}>
          {working ? <span className="size-2.5 rounded-[2px] bg-white" /> : <ArrowUp className="size-[15px]" />}
        </button>
      </div>
    </div>
  );
}

export function UserMessage({ children }: { children: ReactNode }) {
  return <div className="ml-auto w-fit max-w-[520px] rounded-[14px] bg-subtle px-3.5 py-2.5 text-[14px] leading-normal">{children}</div>;
}

/** Coach answers in plain text, with optional steps, actions and follow-ups. */
export function CoachMessage({ worked, steps, children, followUps, onFollowUp }: { worked?: string; steps?: Step[]; children?: ReactNode; followUps?: string[]; onFollowUp?: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {worked && <span className="inline-flex items-center gap-1.5 text-small text-fg-3"><Lightbulb className="size-3.5" aria-hidden />{worked}</span>}
      {steps && <Steps steps={steps} />}
      {children && <div className="text-[14px] leading-[1.6]">{children}</div>}
      {children && (
        <div className="flex gap-3.5 text-fg-3 [&_svg]:size-4">
          <button aria-label="Copy" className="hover:text-fg"><Copy /></button>
          <button aria-label="Good answer" className="hover:text-fg"><ThumbsUp /></button>
          <button aria-label="Bad answer" className="hover:text-fg"><ThumbsDown /></button>
          <button aria-label="Retry" className="hover:text-fg"><RotateCcw /></button>
        </div>
      )}
      {followUps && (
        <div className="flex flex-col items-start gap-1">
          {followUps.map((f) => (
            <button key={f} onClick={() => onFollowUp?.(f)} className="inline-flex h-[30px] items-center gap-2 rounded-row px-1 text-fg-2 hover:text-fg">
              <CornerDownRight className="size-3.5 text-fg-3" aria-hidden />{f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What Coach changed, with a way to open it. */
export function ResultCard({ title, meta, onOpen }: { title: string; meta: string; onOpen?: () => void }) {
  return (
    <div className="flex w-full max-w-[420px] items-center gap-2.5 rounded-card bg-surface p-2.5 ring-[0.5px] ring-border">
      <span className="inline-flex size-7 items-center justify-center rounded-row bg-fg text-white"><FileText className="size-3.5" /></span>
      <span className="flex flex-1 flex-col"><span className="font-medium">{title}</span><span className="text-small text-fg-3">{meta}</span></span>
      <button onClick={onOpen} className="glow-button h-7 rounded-row px-2.5 font-medium text-[#1B1B1F] shadow-glow ring-1 ring-inset ring-white/70">Open</button>
    </div>
  );
}

/** Starter prompts under the composer on Coach home. */
export function Suggestions({ items, onPick }: { items: { label: string; icon: ReactNode }[]; onPick?: (label: string) => void }) {
  return (
    <div className="flex w-full max-w-[720px] gap-2 overflow-x-auto pb-1">
      {items.map((s, i) => (
        <button key={s.label} onClick={() => onPick?.(s.label)}
          className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-body hover:bg-subtle [&_svg]:size-3.5 [&_svg]:text-fg-2', i === 0 ? 'border border-dashed border-border-strong text-fg-2' : 'ring-1 ring-inset ring-border')}>
          {s.icon}{s.label}
        </button>
      ))}
    </div>
  );
}
