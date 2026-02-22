import { AttendeeRoute } from '@/components/guards/AttendeeRoute';
import { AttendeeLayout as Layout } from '@/components/layout/AttendeeLayout';

export default function AttendeeLayoutWrapper() {
  return (
    <AttendeeRoute>
      <Layout />
    </AttendeeRoute>
  );
}
