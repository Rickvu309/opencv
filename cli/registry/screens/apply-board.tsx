import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Plus, Kanban, List, Calendar, ListFilter, SlidersHorizontal, ChevronDown, Link2, Paperclip, X, ChevronRight } from 'lucide-react';
import { PageHeader, Toolbar } from '~components/shell';
import { Button, IconButton } from '~components/button';
import { BoardLane, JobCard, type Job } from '~components/apply';
import { StageIcon, type Stage } from '~components/brand';
import { Dialog } from '~components/overlay';
import { Chip } from '~components/display';
import { useToast } from '~components/feedback';
import { AppFrame, RouterLink } from '~app/app-frame';
import { jobs as seed } from '~app/data';

export const APPLY_TABS = [
  { label: 'Board', href: '/apply', icon: <Kanban /> },
  { label: 'List', href: '/apply/list', icon: <List /> },
  { label: 'Calendar', href: '/apply/calendar', icon: <Calendar /> },
];

const LANES: Stage[] = ['saved', 'applied', 'interview', 'offer'];

/** Apply board: Saved, Applied, Interview, Offer, with Closed hidden. */
export default function ApplyBoard() {
  const [all, setJobs] = useState<Job[]>(seed);
  const [adding, setAdding] = useState(false);
  const deleted = (useLocation().state as { deleted?: string } | null)?.deleted;
  const jobs = all.filter((j) => j.id !== deleted);
  const nav = useNavigate();
  const toast = useToast();
  const closed = jobs.filter((j) => j.stage === 'closed');

  return (
    <AppFrame>
      <PageHeader title="Apply">
        <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>New job</Button>
      </PageHeader>
      <Toolbar tabs={APPLY_TABS} active="/apply" link={RouterLink}>
        <IconButton label="Filter"><ListFilter /></IconButton>
        <IconButton label="Display"><SlidersHorizontal /></IconButton>
      </Toolbar>
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-3 py-2">
        {LANES.map((stage) => {
          const list = jobs.filter((j) => j.stage === stage);
          return (
            <BoardLane key={stage} stage={stage} count={list.length} onAdd={() => setAdding(true)}>
              {list.length ? list.map((j) => <JobCard key={j.id} job={j} onClick={() => nav(`/apply/${j.id}`)} />) : undefined}
            </BoardLane>
          );
        })}
        <div className="flex w-[180px] shrink-0 flex-col gap-2 p-2">
          <div className="flex h-7 items-center gap-1 px-1 text-small text-fg-3">Hidden columns<ChevronDown className="size-3" /></div>
          <span className="inline-flex h-8 items-center gap-2 rounded-row bg-surface px-2.5 ring-[0.5px] ring-border">
            <StageIcon stage="closed" />Closed<span className="text-fg-3">{closed.length}</span>
          </span>
        </div>
      </div>
      <NewJobDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(job) => { setJobs((j) => [job, ...j]); toast({ tone: 'success', message: 'Job added to Saved' }); }}
      />
    </AppFrame>
  );
}

/** Manual first. A link only fills the form; nothing promises a scan. */
export function NewJobDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (j: Job) => void }) {
  const [link, setLink] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [desc, setDesc] = useState('');
  const [tried, setTried] = useState(false);
  const reset = () => { setLink(''); setRole(''); setCompany(''); setDesc(''); setTried(false); };
  const submit = () => {
    setTried(true);
    if (!role.trim() || !company.trim()) {
      document.querySelector<HTMLInputElement>(`[aria-label="${!role.trim() ? 'Role title' : 'Company'}"]`)?.focus();
      return;
    }
    onAdd({ id: crypto.randomUUID(), role: role.trim(), company: company.trim(), stage: 'saved', priority: 'medium', date: 'Today' });
    reset();
    onClose();
  };
  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} width={600}>
      <div className="flex flex-col gap-4 p-4" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}>
        <div className="flex items-center gap-1.5 text-small text-fg-2">
          <Kanban className="size-3.5" />Apply<ChevronRight className="size-3 text-fg-3" />New job
          <span className="flex-1" />
          <button aria-label="Close" onClick={() => { reset(); onClose(); }} className="text-fg-3 hover:text-fg"><X className="size-4" /></button>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-tile bg-subtle px-3">
          <Link2 className="size-3.5 text-fg-3" aria-hidden />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste the job link" aria-label="Job link" className="flex-1 bg-transparent outline-none" />
        </label>
        <div className="flex flex-col gap-1 px-1">
          <input data-autofocus value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role title" aria-label="Role title" aria-invalid={tried && !role.trim()} aria-describedby="nj-role-err" className="bg-transparent text-[20px] font-semibold tracking-[-0.3px] outline-none placeholder:text-placeholder" />
          {tried && !role.trim() && <p id="nj-role-err" className="text-small text-danger">Add the role title to save this job.</p>}
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" aria-label="Company" aria-invalid={tried && !company.trim()} aria-describedby="nj-company-err" className="bg-transparent text-[14px] text-fg-2 outline-none" />
          {tried && !company.trim() && <p id="nj-company-err" className="text-small text-danger">Add the company name to save this job.</p>}
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Add the job description..." aria-label="Job description" rows={4} className="mt-2 resize-none bg-transparent leading-normal outline-none" />
        </div>
        <div className="flex gap-1.5">
          <Chip icon={<StageIcon stage="saved" />}>Saved</Chip>
          <Chip icon={<Calendar className="text-fg-2" />}>Deadline</Chip>
        </div>
        <div className="flex items-center gap-2 border-t-[0.5px] border-border pt-3">
          <IconButton label="Attach a file"><Paperclip /></IconButton>
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" kbd="⌘↵" onClick={submit}>Add job</Button>
        </div>
      </div>
    </Dialog>
  );
}
