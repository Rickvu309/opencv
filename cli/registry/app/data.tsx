import { Gem, Landmark, ShoppingBag, Rocket, PenTool } from 'lucide-react';
import type { Job } from '~components/apply';
import type { Message } from '~components/inbox';

// Sample data from the opencv design. Replace with your API.

export const user = { name: 'Linh Nguyen', initials: 'LN', email: 'linh.nguyen@gmail.com' };

export const jobs: Job[] = [
  { id: 'jm', role: 'Junior Marketing', company: 'Lumière Cosmetics', stage: 'saved', logo: <Gem />, priority: 'high', location: 'HCMC', date: 'Oct 25' },
  { id: 'ux', role: 'UX research intern', company: 'Agency', stage: 'saved', logo: <PenTool />, priority: 'medium', location: 'Hanoi', date: 'Oct 22' },
  { id: 'ba', role: 'Business analyst intern', company: 'Regional bank', stage: 'applied', logo: <Landmark />, priority: 'high', location: 'HCMC', date: 'Oct 14' },
  { id: 'mk', role: 'Marketing intern', company: 'E-commerce co.', stage: 'applied', logo: <ShoppingBag />, priority: 'low', location: 'Remote', date: 'Oct 21' },
  { id: 'apm', role: 'Associate PM intern', company: 'Local startup', stage: 'interview', logo: <Rocket />, priority: 'high', location: 'Hanoi', date: 'Oct 12', interview: 'Interview Thu, 10:00' },
  { id: 'pa', role: 'Product analyst intern', company: 'E-commerce co.', stage: 'interview', logo: <ShoppingBag />, priority: 'medium', location: 'Remote', date: 'Oct 2' },
  { id: 'ci', role: 'Content intern', company: 'Agency', stage: 'closed', logo: <PenTool />, priority: 'low', location: 'HCMC', date: 'Sep 28' },
];

export const messages: Message[] = [
  { id: 'm1', from: 'Regional bank', initials: 'RB', preview: 'Can we do a call Thursday?', time: '9:41', unread: true },
  { id: 'm2', from: 'Local startup', initials: 'LS', preview: 'Interview invite, Thu 10:00', time: '8:02', unread: true },
  { id: 'm3', from: 'Lumière', initials: 'LC', preview: 'Closes in 2 days', time: '7:00', unread: true, urgent: true },
  { id: 'm4', from: 'Fintech app', initials: 'FA', preview: 'No reply in 11 days', time: 'Sun' },
  { id: 'm5', from: 'Agency', initials: 'AG', preview: 'Not moving forward this time', time: 'Sat' },
  { id: 'm6', from: 'E-commerce co.', initials: 'EC', preview: 'Application received', time: 'Oct 21' },
];

export const papers = [
  { id: 'jm-cv', title: 'Junior Marketing CV', meta: 'Edited today' },
  { id: 'pi-cv', title: 'Product Intern CV', meta: 'Edited Oct 20' },
  { id: 'ba-cv', title: 'Business Analyst CV', meta: 'Edited Oct 14' },
];
