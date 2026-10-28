import { useState } from 'react';
import { useParams } from 'react-router';
import { SlidersHorizontal, MessageCircle, Plug, Gauge, CreditCard, CircleUser, Mail, Monitor, FileText, CalendarCheck, ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import { SettingsLayout, SettingsTitle, SettingsSection, SettingsCard, SettingsRow, IntegrationCard } from '~components/settings';
import { Button } from '~components/button';
import { Segmented, Select, Switch } from '~components/choice';
import { UsageBar } from '~components/feedback';
import { Status, Avatar } from '~components/display';
import { SearchInput } from '~components/field';
import { ConfirmDelete } from '~components/overlay';
import { RouterLink } from '~app/app-frame';
import { user } from '~app/data';

const NAV = [
  { label: 'Preferences', href: '/settings', icon: <SlidersHorizontal /> },
  { label: 'Coach', href: '/settings/coach', icon: <MessageCircle /> },
  { label: 'Integrations', href: '/settings/integrations', icon: <Plug /> },
  { label: 'Usage & limits', href: '/settings/usage', icon: <Gauge /> },
  { label: 'Billing', href: '/settings/billing', icon: <CreditCard /> },
  { label: 'Account', href: '/settings/account', icon: <CircleUser /> },
];

/** Settings: Preferences, Coach, Integrations, Usage & limits, Billing, Account. */
export default function Settings() {
  const { section = '' } = useParams();
  const href = section ? `/settings/${section}` : '/settings';
  const Page = { '': Preferences, coach: CoachSettings, integrations: Integrations, usage: Usage, billing: Billing, account: Account }[section] ?? Preferences;
  return (
    <SettingsLayout nav={NAV} activeHref={href} backHref="/apply" link={RouterLink}>
      <Page />
    </SettingsLayout>
  );
}

function Preferences() {
  const [lang, setLang] = useState<'en' | 'vi'>('en');
  const [start, setStart] = useState<'apply' | 'coach' | 'paper'>('apply');
  return (<>
    <SettingsTitle title="Preferences" />
    <SettingsSection label="Interface">
      <SettingsCard>
        <SettingsRow label="Language" desc="Words in menus and buttons" control={<Segmented label="Language" value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'vi', label: 'Tiếng Việt' }]} />} />
        <SettingsRow label="Time zone" desc="Used for interviews and deadlines" control={<Select label="Time zone" value="hcm" onChange={() => {}} options={[{ value: 'hcm', label: 'Ho Chi Minh City (UTC+7)' }, { value: 'sg', label: 'Singapore (UTC+8)' }]} />} />
        <SettingsRow label="Start page" desc="What opens when you sign in" control={<Select label="Start page" value={start} onChange={setStart} options={[{ value: 'apply', label: 'Apply' }, { value: 'coach', label: 'Coach' }, { value: 'paper', label: 'Paper' }]} />} />
      </SettingsCard>
    </SettingsSection>
    <SettingsSection label="Notifications">
      <SettingsCard>
        <SettingsRow icon={<Mail />} label="Email" desc={user.email} control={<Status kind="enabled" />} onClick={() => {}} />
        <SettingsRow icon={<Monitor />} label="Browser" desc="While opencv is open" control={<Status kind="enabled" />} onClick={() => {}} />
      </SettingsCard>
    </SettingsSection>
  </>);
}

function CoachSettings() {
  const [memory, setMemory] = useState(false);
  return (<>
    <SettingsTitle title="Coach">Your career coach across Paper and Apply.</SettingsTitle>
    <SettingsCard className="mb-3"><SettingsRow label="Usage" desc="52% of this week used" control={<ChevronRight className="size-3.5 text-fg-3" />} onClick={() => {}} /></SettingsCard>
    <SettingsCard className="mb-10"><SettingsRow label="Enable memory" desc="Coach remembers past chats. Never used to train models." control={<Switch label="Enable memory" checked={memory} onChange={setMemory} />} /></SettingsCard>
    <SettingsTitle title="Coach agent">Works for you inside Paper and Apply.</SettingsTitle>
    <SettingsCard>
      <SettingsRow icon={<MessageCircle />} label="Coach chat" desc="Set your background and how Coach replies" control={<Status kind="enabled" />} onClick={() => {}} />
      <SettingsRow icon={<FileText />} label="Tailored CVs" desc="Tailor your CV to each job in Apply" control={<Status kind="enabled" />} onClick={() => {}} />
      <SettingsRow icon={<Mail />} label="Email updates" desc="Move jobs when a recruiter replies in Gmail" control={<Status kind="enabled" />} onClick={() => {}} />
      <SettingsRow icon={<CalendarCheck />} label="Weekly plan" desc="Every Monday, the jobs to apply for next" control={<Status kind="disabled" />} onClick={() => {}} />
    </SettingsCard>
  </>);
}

const APPS: Record<string, [string, string, string][]> = {
  Meetings: [['Zoom', 'zoom', 'Add interview calls'], ['Google Meet', 'google-meet', 'Add interview calls'], ['Microsoft Teams', 'microsoft-teams', 'Add interview calls']],
  Files: [['Google Drive', 'drive', 'Import your CV'], ['OneDrive', 'microsoft-onedrive', 'Import your CV'], ['Dropbox', 'dropbox', 'Import your CV']],
  'Notes and design': [['Notion', 'notion', 'Import notes'], ['Figma', 'figma', 'Add design work'], ['Canva', 'canva', 'Import your CV']],
  Profiles: [['LinkedIn', 'linkedin', 'Import experience'], ['GitHub', 'github', 'Add projects'], ['Behance', 'behance', 'Add design work']],
};

function Integrations() {
  const [q, setQ] = useState('');
  const match = (n: string) => n.toLowerCase().includes(q.toLowerCase());
  return (<>
    <SettingsTitle title="Integrations">Connect the apps you already use.</SettingsTitle>
    <SearchInput value={q} onChange={setQ} placeholder="Search integrations" className="mb-7" />
    <SettingsSection label="Enabled">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {match('Gmail') && <IntegrationCard logo="/logos/gmail.png" name="Gmail" line="" state="enabled" />}
        {match('Google Calendar') && <IntegrationCard logo="/logos/google-calendar.png" name="Google Calendar" line="" state="enabled" />}
        {match('Outlook') && <IntegrationCard logo="/logos/outlook.png" name="Outlook" line="" state="expired" />}
      </div>
    </SettingsSection>
    {Object.entries(APPS).map(([group, list]) => {
      const shown = list.filter(([n]) => match(n));
      return shown.length ? (
        <SettingsSection key={group} label={group}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map(([n, f, line]) => <IntegrationCard key={n} logo={`/logos/${f}.png`} name={n} line={line} />)}</div>
        </SettingsSection>
      ) : null;
    })}
  </>);
}

function Usage() {
  return (<>
    <SettingsTitle title="Usage & limits">You're on the Free plan.</SettingsTitle>
    <SettingsSection label="Coach usage">
      <SettingsCard>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-44"><div className="font-medium">Current session</div><div className="text-[12.5px] text-fg-3">Resets in 3 hr 12 min</div></div>
          <UsageBar label="Current session" value={0.34} className="flex-1" /><span className="w-16 text-right text-fg-2">34% used</span>
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-44"><div className="font-medium">This week</div><div className="text-[12.5px] text-fg-3">Resets Monday at 7:00</div></div>
          <UsageBar label="This week" value={0.52} className="flex-1" /><span className="w-16 text-right text-fg-2">52% used</span>
        </div>
      </SettingsCard>
    </SettingsSection>
    <SettingsCard>
      <SettingsRow icon={<ArrowUpRight />} label="Need more?" desc="Pro gives you unlimited Coach chats." control={<Button variant="secondary" size="sm">Upgrade to Pro</Button>} />
    </SettingsCard>
  </>);
}

function Billing() {
  return (<>
    <div className="mb-7 flex items-end justify-between">
      <SettingsTitle title="Billing">You're on the Free plan.</SettingsTitle>
      <RouterLink href="/pricing" className="mb-7 inline-flex items-center gap-1 font-medium">All plans<ChevronRight className="size-3.5" /></RouterLink>
    </div>
    <SettingsCard className="mb-3"><div className="px-5 py-4"><div className="text-title font-medium">Free plan</div><div className="text-fg-2">$0 a month. Limited Coach chats on the basic model.</div></div></SettingsCard>
    <SettingsCard className="mb-7">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div><div className="text-title font-medium">Upgrade to Pro</div><div className="text-fg-2">$9 a month. Cancel anytime.</div></div>
          <Button variant="primary">Upgrade now</Button>
        </div>
        <div className="h-px bg-border" />
        <ul className="grid grid-cols-2 gap-2.5">
          {['Unlimited Coach chats', 'Priority support', 'Stronger Coach model', 'Early access to Proof'].map((f) => <li key={f} className="flex items-center gap-2"><Check className="size-3.5" />{f}</li>)}
        </ul>
      </div>
    </SettingsCard>
    <SettingsSection label="Payment">
      <SettingsCard>
        <SettingsRow label="Payment method" desc="No card added" control={<Button variant="secondary" size="sm">Add card</Button>} />
        <SettingsRow label="Invoices" desc="None yet" />
      </SettingsCard>
    </SettingsSection>
  </>);
}

function Account() {
  const [confirm, setConfirm] = useState(false);
  return (<>
    <SettingsTitle title="Account" />
    <SettingsSection label="Profile">
      <SettingsCard>
        <SettingsRow icon={<Avatar initials={user.initials} size={32} />} label={user.name} desc={user.email} control={<Button variant="secondary" size="sm">Change photo</Button>} />
        <SettingsRow label="Email" desc="We send sign-in codes here" control={<Button variant="secondary" size="sm">Change email</Button>} />
      </SettingsCard>
    </SettingsSection>
    <SettingsSection label="Data">
      <SettingsCard>
        <SettingsRow label="Export your data" desc="Paper, Apply and Pitch as files" control={<Button variant="secondary" size="sm">Export</Button>} />
        <SettingsRow label="Sign out" desc="Signed in on this device" control={<Button variant="secondary" size="sm">Sign out</Button>} />
      </SettingsCard>
    </SettingsSection>
    <SettingsCard>
      <SettingsRow label="Delete account" desc="Removes your Paper, Apply jobs and Pitch" control={<Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>Delete account</Button>} />
    </SettingsCard>
    <ConfirmDelete open={confirm} onClose={() => setConfirm(false)} onConfirm={() => {}} thing="your account" confirmLabel="Delete account" />
  </>);
}
