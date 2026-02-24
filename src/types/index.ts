export interface CongressEvent {
  id: string;
  name: string;
  event_code: string;
  start_date: string;
  end_date: string;
  venue_name: string | null;
  venue_address: string | null;
  description: string | null;
  status: string | null;
  settings: Record<string, unknown> | null;
  organization_id: string;
  max_attendees: number | null;
}

export interface AttendeeProfile {
  id: string;
  full_name: string;
  email: string;
  credential_code: string;
  registration_status: string | null;
  event_id: string;
  selected_package_id: string | null;
  phone: string | null;
  document_type: string | null;
  document_number: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  roles: string[];
}

export type RegistrationStatus = 'confirmed' | 'pending' | 'cancelled';

export type SponsorLevel = 'gold' | 'silver' | 'bronze' | 'exhibitor';

export type ActivityType = 'talk' | 'workshop' | 'other' | 'ceremony' | 'networking' | 'symposium' | 'conference_day';

export interface EventActivity {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  activity_type: ActivityType | null;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  requires_checkin: boolean | null;
  capacity: number | null;
  checkin_code: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SessionInterest {
  id: string;
  event_id: string;
  session_id: string;
  user_id: string;
  created_at: string | null;
}

export interface AttendeeCheckin {
  id: string;
  activity_id: string;
  attendee_id: string;
  checked_in_at: string | null;
}

export interface DocumentRow {
  id: string;
  event_id: string;
  session_id: string | null;
  title: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  download_count: number;
  created_at: string | null;
}
