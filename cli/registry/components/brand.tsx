import { cn } from './cn';

/** The opencv mark: a square frame with a quarter disc. Never redraw or recolor it. */
export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" stroke="currentColor" strokeWidth="2.4" />
      <path d="M2 22H16A14 14 0 0 0 2 8Z" fill="currentColor" />
    </svg>
  );
}

/** "[mark] opencv". Never write "OpenCV". Pass `lead` for headings like "Log in to [mark] opencv". */
export function Brand({ lead, size = 13, className }: { lead?: string; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center justify-center font-semibold', className)} style={{ fontSize: size, gap: Math.round(size * 0.28), letterSpacing: `${-size * 0.03}px` }}>
      {lead && <span className="whitespace-nowrap">{lead}</span>}
      <span className="inline-flex items-center" style={{ gap: Math.round(size * 0.28) }}>
        <Mark size={Math.round(size * 0.92)} />
        <span>opencv</span>
      </span>
    </span>
  );
}

export type Stage = 'saved' | 'applied' | 'interview' | 'offer' | 'closed';

const STAGE_COLOR: Record<Stage, string> = {
  saved: 'var(--color-stage-saved)',
  applied: 'var(--color-stage-applied)',
  interview: 'var(--color-stage-interview)',
  offer: 'var(--color-stage-offer)',
  closed: 'var(--color-stage-closed)',
};

export const STAGE_LABEL: Record<Stage, string> = {
  saved: 'Saved', applied: 'Applied', interview: 'Interview', offer: 'Offer', closed: 'Closed',
};

/** Stage icons are the only colored UI in the app. */
export function StageIcon({ stage, size = 14, className }: { stage: Stage; size?: number; className?: string }) {
  const c = STAGE_COLOR[stage];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" role="img" aria-label={STAGE_LABEL[stage]} className={cn('shrink-0', className)}>
      {stage === 'saved' && <circle cx="7" cy="7" r="5.75" stroke={c} strokeWidth="1.5" />}
      {stage === 'applied' && (<>
        <circle cx="7" cy="7" r="5.75" stroke={c} strokeWidth="1.5" />
        <path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z" fill={c} />
      </>)}
      {stage === 'interview' && (<>
        <circle cx="7" cy="7" r="5.75" stroke={c} strokeWidth="1.5" />
        <path d="M7 3.5A3.5 3.5 0 1 1 3.5 7H7Z" fill={c} />
      </>)}
      {stage === 'offer' && (<>
        <circle cx="7" cy="7" r="6.5" fill={c} />
        <path d="M4.4 7.2 6.2 9 9.7 5.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>)}
      {stage === 'closed' && (<>
        <circle cx="7" cy="7" r="6.5" fill={c} />
        <path d="M5 5 9 9M9 5 5 9" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      </>)}
    </svg>
  );
}

/** Google "G" for sign in. Brand logos are never recolored. */
export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
