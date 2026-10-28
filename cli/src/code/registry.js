// Reads the React registry (registry/components, registry/screens, registry/app) and resolves dependencies.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'registry');

export const NPM_DEPS = {
  react: '^19.1.0',
  'react-dom': '^19.1.0',
  'react-router': '^7.6.0',
  'lucide-react': '^0.511.0',
  '@fontsource-variable/inter': '^5.2.5',
};
export const NPM_DEV_DEPS = {
  vite: '^6.3.5',
  '@vitejs/plugin-react': '^4.5.0',
  tailwindcss: '^4.1.8',
  '@tailwindcss/vite': '^4.1.8',
  typescript: '~5.8.3',
  '@types/react': '^19.1.6',
  '@types/react-dom': '^19.1.5',
};

export const SCREENS = [
  { name: 'apply-board', title: 'Apply board', route: '/apply', desc: 'Stage lanes with job cards, hidden Closed column, New job dialog.' },
  { name: 'apply-list', title: 'Apply list', route: '/apply/list', desc: 'Job rows grouped by stage, collapsible groups.' },
  { name: 'apply-calendar', title: 'Apply calendar', route: '/apply/calendar', desc: 'Month grid with stage-icon events.' },
  { name: 'job-detail', title: 'Job detail', route: '/apply/:id', desc: 'Job description column, properties rail, interview prep, activity, delete with confirm.' },
  { name: 'inbox', title: 'Inbox', route: '/inbox', desc: 'Recruiter messages list and reading pane with a move-to-Interview prompt.' },
  { name: 'coach', title: 'Coach', route: '/coach', desc: 'Coach home with starter prompts, then a live thread with working steps and a result card.' },
  { name: 'paper', title: 'Paper library', route: '/paper', desc: 'CVs as thumbnails, search, New CV.' },
  { name: 'paper-doc', title: 'Paper editor', route: '/paper/:id', desc: 'A4 CV on the desk, breadcrumb top bar, selection toolbar.' },
  { name: 'jobs', title: 'Jobs (coming soon)', route: '/jobs', desc: 'Coming soon page with Notify me and a faded peek.' },
  { name: 'settings', title: 'Settings', route: '/settings/:section?', desc: 'Preferences, Coach, Integrations, Usage & limits, Billing, Account.' },
  { name: 'sign-in', title: 'Sign in', route: '/login', desc: 'Email, 6 digit code, verifying, wrong code, welcome.' },
];

const COMPONENT_DESC = {
  cn: 'Class name helper.',
  brand: 'Mark (logo), Brand ("[mark] opencv"), StageIcon, GoogleG.',
  button: 'Button (primary glow, secondary, ghost, danger; sm md lg; loading; kbd), IconButton, TextLink.',
  field: 'Field (label, helper, error), Input, Textarea, SearchInput.',
  choice: 'Select, Segmented, Switch, Checkbox, Radio.',
  display: 'Badge, Chip, Kbd, Status (Enabled/Disabled), Avatar, IconTile, LogoTile.',
  feedback: 'Meter, UsageBar, Steps, Skeleton, Banner, StateMessage, ToastProvider + useToast.',
  overlay: 'Dialog, ConfirmDelete, Menu.',
  shell: 'AppShell, Sidebar, NavItem, Dock, PageHeader, Toolbar (view tabs), DetailHeader, BackLink.',
  apply: 'JobCard, JobRow, ListGroup, BoardLane, Property, RailSection, ChecklistItem, ActivityItem, PriorityBars, CompanyTile.',
  inbox: 'InboxRow.',
  coach: 'Composer (with the Free model pill), ModelPill, UserMessage, CoachMessage, ResultCard, Suggestions.',
  settings: 'SettingsLayout, SettingsTitle, SettingsSection, SettingsCard, SettingsRow, IntegrationCard.',
  paper: 'PaperPage, CvName, CvContact, CvSection, CvEntry, CvBullet, PaperCard, NewPaperCard, SectionHead, MiniCv.',
};

const read = (...p) => readFileSync(join(REGISTRY, ...p), 'utf8');

function parse(src) {
  const exports = [...src.matchAll(/export (?:const|function|type|interface) (\w+)/g)].map((m) => m[1]);
  const local = [...src.matchAll(/from ['"]\.\/([\w-]+)['"]/g)].map((m) => m[1]);
  const comps = [...src.matchAll(/from ['"]~components\/([\w-]+)['"]/g)].map((m) => m[1]);
  const app = [...src.matchAll(/from ['"]~app\/([\w-]+)['"]/g)].map((m) => m[1]);
  const npm = [...src.matchAll(/from ['"]((?:@[\w-]+\/)?[\w-]+)[^'"]*['"]/g)].map((m) => m[1]).filter((n) => !n.startsWith('.'));
  return { exports, local, comps, app, npm: [...new Set(npm)] };
}

let cache;
export function registry() {
  if (cache) return cache;
  const components = {};
  for (const f of readdirSync(join(REGISTRY, 'components'))) {
    const name = f.replace(/\.tsx?$/, '');
    const src = read('components', f);
    const p = parse(src);
    components[name] = { name, file: f, src, exports: p.exports, deps: p.local, npm: p.npm, desc: COMPONENT_DESC[name] || '' };
  }
  const app = {};
  for (const f of readdirSync(join(REGISTRY, 'app'))) {
    const name = f.replace(/\.tsx?$/, '');
    const src = read('app', f);
    const p = parse(src);
    app[name] = { name, file: f, src, comps: p.comps, app: p.app, npm: p.npm };
  }
  const screens = {};
  for (const s of SCREENS) {
    const file = `${s.name}.tsx`;
    const src = read('screens', file);
    const p = parse(src);
    screens[s.name] = { ...s, file, src, comps: p.comps, app: p.app, screens: p.local, npm: p.npm, exports: p.exports };
  }
  cache = { components, app, screens };
  return cache;
}

/** Component names or export names ("Button", "JobCard", "apply") to component files, with dependencies. */
export function resolveComponents(names) {
  const { components } = registry();
  const out = new Set();
  const missing = [];
  const visit = (n) => {
    if (out.has(n)) return;
    out.add(n);
    for (const d of components[n].deps) visit(d);
  };
  for (const raw of names) {
    const key = raw.toLowerCase();
    const hit = components[key] || Object.values(components).find((c) => c.exports.some((e) => e.toLowerCase() === key));
    if (hit) visit(hit.name); else missing.push(raw);
  }
  return { files: [...out], missing };
}

/** Everything a screen needs: screen files, components, app files. */
export function resolveScreen(names) {
  const { screens, app } = registry();
  const scr = new Set();
  const comps = new Set();
  const apps = new Set();
  const missing = [];
  const visitApp = (n) => {
    if (apps.has(n)) return;
    apps.add(n);
    app[n].comps.forEach((c) => comps.add(c));
    app[n].app.forEach(visitApp);
  };
  const visit = (n) => {
    if (scr.has(n)) return;
    scr.add(n);
    const s = screens[n];
    s.comps.forEach((c) => comps.add(c));
    s.app.forEach(visitApp);
    s.screens.forEach(visit);
  };
  for (const n of names) (screens[n] ? visit(n) : missing.push(n));
  const resolved = resolveComponents([...comps]);
  return { screens: [...scr], components: resolved.files, app: [...apps], missing };
}
