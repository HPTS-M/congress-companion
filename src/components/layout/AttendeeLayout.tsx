import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { HamburgerMenu } from './HamburgerMenu';
import { AttendeeSidebar } from './AttendeeSidebar';

export function AttendeeLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop sidebar — hidden on mobile via className inside component */}
        <AttendeeSidebar />

        <div className="flex flex-1 flex-col">
          <AppHeader onMenuOpen={() => setMenuOpen(true)} />
          <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen} />

          {/* Main content — between header (56px) and bottom nav (64px on mobile) */}
          <main className="flex-1 overflow-y-auto pt-[7.5rem] pb-0 md:pt-32 md:pb-0">
            <Outlet />
          </main>

          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
