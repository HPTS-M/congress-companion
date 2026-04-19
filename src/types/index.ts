export interface EventSettings {
  qr_enabled?: boolean;
  contacts_enabled?: boolean;
  documents_enabled?: boolean;
  notes_enabled?: boolean;
  messaging_enabled?: boolean;
  announcements_enabled?: boolean;
  ratings_enabled?: boolean;
  venue_map_enabled?: boolean;
  polls_enabled?: boolean;
  tickets_enabled?: boolean;
  commercial_enabled?: boolean;
  banner_url?: string;
  header_logo_url?: string;
  /** When true, attendees use externally-provided credential codes instead of the auto-generated one. */
  external_credentials_enabled?: boolean;
  /** When true, document downloads are enabled in the attendee app. */
  documents_download_enabled?: boolean;
}

export interface AttendeeProfileExtended {
  external_credential_code?: string | null;
}

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
  settings: EventSettings | null;
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
  speaker_photo_url?: string | null;
  archived_at?: string | null;
  sort_order?: number | null;
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
