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
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminAttendees = lazy(() => import('@/pages/admin/Attendees'));
const AdminAgenda = lazy(() => import('@/pages/admin/Agenda'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Attendee pages
const Home = lazy(() => import('@/pages/attendee/Home'));
const Agenda = lazy(() => import('@/pages/attendee/Agenda'));
const PlaceholderPage = lazy(() => import('@/pages/attendee/PlaceholderPage'));
const Documents = lazy(() => import('@/pages/attendee/Documents'));
const Notes = lazy(() => import('@/pages/attendee/Notes'));
const Messaging = lazy(() => import('@/pages/attendee/Messaging'));
const Announcements = lazy(() => import('@/pages/attendee/Announcements'));
const CheckIn = lazy(() => import('@/pages/attendee/CheckIn'));
const Tickets = lazy(() => import('@/pages/attendee/Tickets'));
const Commercial = lazy(() => import('@/pages/attendee/Commercial'));
const SponsorDetail = lazy(() => import('@/pages/attendee/SponsorDetail'));
const Contacts = lazy(() => import('@/pages/attendee/Contacts'));
const AttendeeProfile = lazy(() => import('@/pages/attendee/AttendeeProfile'));
const Ratings = lazy(() => import('@/pages/attendee/Ratings'));

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

                {/* Protected admin routes */}
                <Route path="admin" element={<AdminLayout />}>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="users" element={<AdminAttendees />} />
                  <Route path="agenda" element={<AdminAgenda />} />
                </Route>

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
                  <Route path="documents" element={<Documents />} />
                  <Route path="notes" element={<Notes />} />
                  <Route path="messaging" element={<Messaging />} />
                  <Route path="announcements" element={<Announcements />} />
                  <Route path="ratings" element={<Ratings />} />
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
