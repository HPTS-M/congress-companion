import { lazy, Suspense } from 'react'; // Phase 1
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
                {/* Phase 2 attendee routes will go here */}
                {/* Phase 2 admin routes will go here */}
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
