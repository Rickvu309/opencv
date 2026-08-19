'use client';

import { SidebarProvider } from '../../kit/sidebar';
import { AppSidebar } from '../sidebar-06/app-sidebar';

export default function Page() {
  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full">
        <AppSidebar />
      </div>
    </SidebarProvider>
  );
}
