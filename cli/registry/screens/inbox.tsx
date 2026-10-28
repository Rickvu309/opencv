import { useState } from 'react';
import { Check, Clock3, Ellipsis, ListFilter, SlidersHorizontal, ChevronUp, ChevronDown, Calendar, Kanban } from 'lucide-react';
import { IconButton, Button } from '~components/button';
import { InboxRow } from '~components/inbox';
import { Avatar } from '~components/display';
import { StageIcon } from '~components/brand';
import { AppFrame } from '~app/app-frame';
import { messages } from '~app/data';

/** Inbox: list pane on the left, the open message on the right. */
export default function Inbox() {
  const [openId, setOpenId] = useState(messages[0].id);
  const i = messages.findIndex((m) => m.id === openId);
  const m = messages[i];
  return (
    <AppFrame>
      <div className="flex min-h-0 flex-1">
        <section className="flex w-[460px] shrink-0 flex-col border-r-[0.5px] border-border" aria-label="Messages">
          <header className="flex h-[52px] shrink-0 items-center gap-1 border-b-[0.5px] border-border pr-3 pl-5">
            <h1 className="font-medium">Inbox</h1>
            <IconButton label="More" size={24}><Ellipsis /></IconButton>
            <span className="flex-1" />
            <IconButton label="Snoozed"><Clock3 /></IconButton>
            <IconButton label="Filter"><ListFilter /></IconButton>
            <IconButton label="Display"><SlidersHorizontal /></IconButton>
          </header>
          <div className="flex flex-col p-1.5">
            {messages.map((msg) => <InboxRow key={msg.id} message={msg} selected={msg.id === openId} onClick={() => setOpenId(msg.id)} />)}
          </div>
        </section>
        <section className="flex min-w-0 flex-1 flex-col" aria-label="Message">
          <header className="flex h-11 shrink-0 items-center gap-1 border-b-[0.5px] border-border px-4">
            <Button variant="ghost" size="sm" icon={<Check className="size-3.5" />}>Done</Button>
            <Button variant="ghost" size="sm" icon={<Clock3 className="size-3.5" />}>Snooze</Button>
            <IconButton label="More" size={24}><Ellipsis /></IconButton>
            <span className="flex-1" />
            <span className="mr-1 text-small text-fg-3">{i + 1} of {messages.length}</span>
            <IconButton label="Previous" size={24} onClick={() => setOpenId(messages[Math.max(0, i - 1)].id)}><ChevronUp /></IconButton>
            <IconButton label="Next" size={24} onClick={() => setOpenId(messages[Math.min(messages.length - 1, i + 1)].id)}><ChevronDown /></IconButton>
          </header>
          <div className="flex flex-col gap-5 overflow-y-auto px-8 py-6">
            <h2 className="text-[18px] font-semibold tracking-[-0.3px]">Re: Business Analyst application</h2>
            <div className="flex items-center gap-2.5 rounded-card bg-subtle px-3 py-2.5">
              <Calendar className="size-4 text-indigo" aria-hidden />
              <span className="flex-1"><span className="font-medium">Interview request</span> <span className="text-fg-2">Move this job to Interview?</span></span>
              <Button size="sm" variant="primary" icon={<Kanban className="size-3.5" />}>Move to Interview</Button>
            </div>
            <div className="flex items-start gap-3">
              <Avatar initials={m.initials} size={28} />
              <div className="flex flex-col gap-3 leading-[1.6]">
                <div><span className="font-medium">{m.from}</span> <span className="text-fg-3">to you, {m.time}</span></div>
                <p>Hi Linh,</p>
                <p>Thanks for applying for the Business Analyst internship. Your background fits what we need, especially the checkout study.</p>
                <p>Can we do a 30 minute call on Thursday afternoon? Any time after 14:00 works for us.</p>
                <p>Best,<br />Hanh Tran</p>
              </div>
            </div>
            <div className="ml-10 flex items-center gap-2 text-small text-fg-2">
              <StageIcon stage="applied" />Linked to Business analyst intern in Apply
            </div>
          </div>
        </section>
      </div>
    </AppFrame>
  );
}
