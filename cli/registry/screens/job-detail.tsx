import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Calendar, Flag, Link2, MapPin, Plus, FileText, Star, Ellipsis, Trash2, ArrowRight, User } from 'lucide-react';
import { DetailHeader } from '~components/shell';
import { IconButton } from '~components/button';
import { StageIcon, STAGE_LABEL } from '~components/brand';
import { ActivityItem, ChecklistItem, CompanyTile, PriorityBars, Property, RailSection } from '~components/apply';
import { ConfirmDelete, Menu } from '~components/overlay';
import { Textarea } from '~components/field';
import { useToast } from '~components/feedback';
import { AppFrame, RouterLink } from '~app/app-frame';
import { jobs } from '~app/data';

/** Job detail: the job description in a 720 column, properties in a 288 rail. */
export default function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const index = Math.max(0, jobs.findIndex((j) => j.id === id));
  const job = jobs[index] ?? jobs[0];
  const [prep, setPrep] = useState([true, false, false]);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const del = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) setConfirm(true);
    };
    document.addEventListener('keydown', del);
    return () => document.removeEventListener('keydown', del);
  }, []);
  const go = (d: number) => nav(`/apply/${jobs[(index + d + jobs.length) % jobs.length].id}`);

  return (
    <AppFrame dock={['Prep for this interview', 'Tailor your CV']}>
      <DetailHeader parent="Apply" parentHref="/apply" icon={job.logo} title={job.role} position={`${index + 1} / ${jobs.length}`} onPrev={() => go(-1)} onNext={() => go(1)} link={RouterLink}>
        <IconButton label="Favorite" size={24}><Star /></IconButton>
        <div className="relative">
          <IconButton label="More" size={24} onClick={() => setMenu((m) => !m)}><Ellipsis /></IconButton>
          {menu && (
            <Menu className="absolute top-8 right-0 z-30" onClose={() => setMenu(false)} items={[
              { label: 'Move to Offer', icon: <ArrowRight />, onSelect: () => setMenu(false) },
              { divider: true, label: '' },
              { label: 'Delete job', icon: <Trash2 />, destructive: true, kbd: '⌫', onSelect: () => { setMenu(false); setConfirm(true); } },
            ]} />
          )}
        </div>
      </DetailHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="flex shrink-0 justify-center px-5 py-6 md:flex-1 md:shrink md:overflow-y-auto md:px-12 md:py-10">
          <div className="flex w-[720px] max-w-full flex-col gap-1">
            <h1 className="text-[24px] font-semibold tracking-[-0.5px]">{job.role}</h1>
            <div className="mb-6 flex items-center gap-2 text-fg-2"><CompanyTile icon={job.logo} size={20} />{job.company}</div>
            <JD title="About the role">Join a 12-person team building a savings app for students. You will own small features from idea to launch.</JD>
            <JD title="What you'll do" items={['Run user interviews and turn notes into clear problems', 'Write short specs with two engineers', 'Track what changed after each release']} />
            <JD title="What they look for" items={['Final-year student or recent graduate', 'Clear writing in English and Vietnamese', 'Curious about how people manage money']} />
            <JD title="Details" items={['6 month internship, starting January', 'Hybrid in Hanoi, 3 days in the office', 'Paid, 6 to 8 million VND a month']} />
            <div className="mt-6 flex h-7 items-center gap-2 font-medium">Interview prep <span className="font-normal text-fg-3">{prep.filter(Boolean).length}/3</span></div>
            {['Read about their savings app', 'Practise three PM questions', 'Bring the checkout study'].map((t, i) => (
              <ChecklistItem key={t} done={prep[i]} onToggle={() => setPrep((p) => p.map((v, j) => (j === i ? !v : v)))}>{t}</ChecklistItem>
            ))}
            <div className="mt-6 mb-2 font-medium">Activity</div>
            <ActivityItem icon={<Plus />} when="Oct 10">You added this job from ITviec</ActivityItem>
            <ActivityItem icon={<FileText />} when="Oct 11">You linked Junior Marketing CV</ActivityItem>
            <ActivityItem icon={<ArrowRight />} when="Oct 12">Moved to {STAGE_LABEL[job.stage]}</ActivityItem>
            <Textarea className="mt-3" rows={2} placeholder="Leave a note..." aria-label="Leave a note" />
          </div>
        </div>
        <aside className="flex w-full shrink-0 flex-col gap-4 border-t-[0.5px] border-border md:w-[288px] md:border-t-0 md:border-l-[0.5px] bg-[#FAFAFA] px-3 py-4" aria-label="Properties">
          <RailSection title="Properties">
            <Property icon={<StageIcon stage={job.stage} />}>{STAGE_LABEL[job.stage]}</Property>
            <Property icon={<PriorityBars level={job.priority} />}>{job.priority === 'high' ? 'High priority' : job.priority === 'low' ? 'Low priority' : 'Medium priority'}</Property>
            {job.location && <Property icon={<MapPin className="text-info" />}>{job.location}</Property>}
            <Property icon={<Calendar className="text-indigo" />}>{job.interview ?? 'Add interview'}</Property>
            <Property icon={<Flag />} empty>Add deadline</Property>
            <Property icon={<User />}>Minh Tran</Property>
            <Property icon={<Link2 />}>itviec.com</Property>
          </RailSection>
          <RailSection title="Paper">
            <Property icon={<FileText />}>Junior Marketing CV</Property>
            <Property icon={<Plus />} empty>Add cover letter</Property>
          </RailSection>
        </aside>
      </div>
      <ConfirmDelete open={confirm} onClose={() => setConfirm(false)} thing={job.role} confirmLabel="Delete job"
        onConfirm={() => {
          nav('/apply', { state: { deleted: job.id } });
          toast({ tone: 'success', message: 'Job deleted', action: { label: 'Undo', onClick: () => nav('/apply', { replace: true }) } });
        }} />
    </AppFrame>
  );
}

function JD({ title, children, items }: { title: string; children?: string; items?: string[] }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 font-semibold">{title}</h2>
      {children && <p className="leading-[1.6] text-fg-2">{children}</p>}
      {items && <ul className="flex flex-col gap-1 pl-4 text-fg-2">{items.map((i) => <li key={i} className="list-disc leading-[1.55]">{i}</li>)}</ul>}
    </section>
  );
}
