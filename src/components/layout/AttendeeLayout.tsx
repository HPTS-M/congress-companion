import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { HamburgerMenu } from './HamburgerMenu';

export function AttendeeLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onMenuOpen={() => setMenuOpen(true)} />
      <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen} />

      {/* Main content — between header (56px) and bottom nav (64px) */}
      <main className="flex-1 overflow-y-auto pt-14 pb-16 md:pt-16">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
