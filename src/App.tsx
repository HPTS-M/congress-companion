import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { EventProvider } from '@/components/layout/EventProvider';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy loaded pages
const Index = lazy(() => import('@/pages/Index'));
const AttendeeLogin = lazy(() => import('@/pages/attendee/Login'));
const AdminLogin = lazy(() => import('@/pages/admin/Login'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Attendee pages
const Home = lazy(() => import('@/pages/attendee/Home'));
const Agenda = lazy(() => import('@/pages/attendee/Agenda'));
const PlaceholderPage = lazy(() => import('@/pages/attendee/PlaceholderPage'));
const CheckIn = lazy(() => import('@/pages/attendee/CheckIn'));
const Tickets = lazy(() => import('@/pages/attendee/Tickets'));
const Commercial = lazy(() => import('@/pages/attendee/Commercial'));
const SponsorDetail = lazy(() => import('@/pages/attendee/SponsorDetail'));
const Contacts = lazy(() => import('@/pages/attendee/Contacts'));
const AttendeeProfile = lazy(() => import('@/pages/attendee/AttendeeProfile'));

// Layout
const AttendeeLayout = lazy(() => import('@/pages/attendee/AttendeeLayoutWrapper'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />

              {/* Event-scoped routes */}
              <Route path="/:eventSlug" element={<EventProvider />}>
                <Route index element={<AttendeeLogin />} />
                <Route path="admin/login" element={<AdminLogin />} />

                {/* Protected attendee routes */}
                <Route element={<AttendeeLayout />}>
                  <Route path="home" element={<Home />} />
                  <Route path="agenda" element={<Agenda />} />
                  <Route path="checkin" element={<CheckIn />} />
                  <Route path="tickets" element={<Tickets />} />
                  <Route path="commercial" element={<Commercial />} />
                  <Route path="commercial/:sponsorId" element={<SponsorDetail />} />
                  <Route path="contacts" element={<Contacts />} />
                  <Route path="contacts/:attendeeId" element={<AttendeeProfile />} />
                  <Route path="documents" element={<PlaceholderPage titleKey="nav.documents" />} />
                  <Route path="notes" element={<PlaceholderPage titleKey="nav.notes" />} />
                  <Route path="messaging" element={<PlaceholderPage titleKey="nav.messaging" />} />
                  <Route path="announcements" element={<PlaceholderPage titleKey="nav.announcements" />} />
                  <Route path="ratings" element={<PlaceholderPage titleKey="nav.ratings" />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
