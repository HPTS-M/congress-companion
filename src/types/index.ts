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

export type ActivityType = 'conference' | 'workshop' | 'break' | 'plenary';
