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
const AdminDocuments = lazy(() => import('@/pages/admin/Documents'));
const AdminSponsors = lazy(() => import('@/pages/admin/Sponsors'));
const AdminLogistics = lazy(() => import('@/pages/admin/Logistics'));
const AdminLogisticsAssign = lazy(() => import('@/pages/admin/LogisticsAssign'));
const AdminProviders = lazy(() => import('@/pages/admin/Providers'));
const AdminCommunications = lazy(() => import('@/pages/admin/Communications'));
const AdminCheckinStaff = lazy(() => import('@/pages/admin/CheckinStaff'));
const AdminStaff = lazy(() => import('@/pages/admin/Staff'));
const AdminReports = lazy(() => import('@/pages/admin/Reports'));
const AdminPolls = lazy(() => import('@/pages/admin/Polls'));
const AdminEventConfig = lazy(() => import('@/pages/admin/EventConfig'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Staff portal
const StaffLogin = lazy(() => import('@/pages/staff/Login'));
const StaffCheckinView = lazy(() => import('@/pages/staff/CheckinView'));

// Provider portal
const ProviderLogin = lazy(() => import('@/pages/provider/Login'));
const ProviderChangePassword = lazy(() => import('@/pages/provider/ChangePassword'));
const ProviderDashboard = lazy(() => import('@/pages/provider/Dashboard'));
const ProviderServiceAttendees = lazy(() => import('@/pages/provider/ServiceAttendees'));

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
const AttendeePolls = lazy(() => import('@/pages/attendee/Polls'));
const MyProfile = lazy(() => import('@/pages/attendee/MyProfile'));
const VenueMap = lazy(() => import('@/pages/attendee/VenueMap'));

// Layout
const AttendeeLayout = lazy(() => import('@/pages/attendee/AttendeeLayoutWrapper'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min — fresh enough without hammering the server
      gcTime: 10 * 60 * 1000, // collect unused cache after 10 min (memory cap)
      retry: 1,
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: false, // avoid double fetch when returning from background
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
                  <Route path="config" element={<AdminEventConfig />} />
                  <Route path="users" element={<AdminAttendees />} />
                  <Route path="agenda" element={<AdminAgenda />} />
                  <Route path="documents" element={<AdminDocuments />} />
                  <Route path="sponsors" element={<AdminSponsors />} />
                  <Route path="logistics" element={<AdminLogistics />} />
                  <Route path="logistics/:serviceId/assign" element={<AdminLogisticsAssign />} />
                  <Route path="providers" element={<AdminProviders />} />
                  <Route path="communications" element={<AdminCommunications />} />
                  <Route path="checkin-staff" element={<AdminCheckinStaff />} />
                  <Route path="staff" element={<AdminStaff />} />
                  <Route path="polls" element={<AdminPolls />} />
                  <Route path="reports" element={<AdminReports />} />
                </Route>

                {/* Staff portal routes */}
                <Route path="staff" element={<StaffLogin />} />
                <Route path="staff/checkin" element={<StaffCheckinView />} />

                {/* Provider portal routes */}
                <Route path="provider" element={<ProviderLogin />} />
                <Route path="provider/change-password" element={<ProviderChangePassword />} />
                <Route path="provider/dashboard" element={<ProviderDashboard />} />
                <Route path="provider/service/:serviceId" element={<ProviderServiceAttendees />} />

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
                  <Route path="polls" element={<AttendeePolls />} />
                  <Route path="profile" element={<MyProfile />} />
                  <Route path="venue-map" element={<VenueMap />} />
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
