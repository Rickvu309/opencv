import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Inbox, MessageCircle, Briefcase, FileText, Kanban, Presentation, Gem, Award } from 'lucide-react';
import { AppShell, Sidebar, Dock, type LinkLike, type NavSection } from '~components/shell';
import { user } from '~app/data';

/** Router-aware link for opencv components. */
export const RouterLink: LinkLike = ({ href, ...rest }) => <Link to={href} {...rest} />;

export const NAV: NavSection[] = [
  { items: [
    { label: 'Inbox', href: '/inbox', icon: <Inbox />, count: 4 },
    { label: 'Coach', href: '/coach', icon: <MessageCircle /> },
    { label: 'Jobs', href: '/jobs', icon: <Briefcase /> },
  ] },
  { title: 'Your work', items: [
    { label: 'Paper', href: '/paper', icon: <FileText /> },
    { label: 'Apply', href: '/apply', icon: <Kanban /> },
    { label: 'Pitch', href: '/pitch', icon: <Presentation /> },
  ] },
  { title: 'Favorites', items: [
    { label: 'Junior Marketing CV', href: '/paper/jm-cv', icon: <FileText /> },
    { label: 'Lumière application', href: '/apply/jm', icon: <Gem /> },
    { label: 'Checkout UX study', href: '/pitch/checkout', icon: <Award /> },
  ] },
];

/** The app shell wired to the router. Every app screen renders inside it. */
export function AppFrame({ children, dock, panel }: { children: ReactNode; dock?: string[]; panel?: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AppShell
      sidebar={<Sidebar sections={NAV} activeHref={pathname} user={user} link={RouterLink} />}
      dock={<Dock suggestions={dock ?? ['Tailor your CV for Lumière', 'Prep for Local startup interview']} />}
      panel={panel}
    >
      {children}
    </AppShell>
  );
}
