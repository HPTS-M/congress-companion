import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, UserCheck, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MobilePagination } from '@/components/ui/mobile-pagination';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useEventAttendees, useMyContacts, useSendContactRequest, useAcceptContact, useRejectContact, useCancelContactRequest } from '@/hooks/useContacts';
import type { ContactRow, DirectoryAttendee } from '@/services/contacts.service';

const PAGE_SIZE = 10;

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function ContactSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1 min-w-0">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

interface AttendeeCardProps {
  attendee: DirectoryAttendee;
  contactStatus: 'none' | 'sent' | 'received' | 'accepted';
  onConnect: () => void;
  onTap: () => void;
  isSending: boolean;
}

function AttendeeCard({ attendee, contactStatus, onConnect, onTap, isSending }: AttendeeCardProps) {
  const { t } = useTranslation('contacts');

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onTap}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A56A0] text-white text-sm font-semibold">
        {getInitials(attendee.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] sm:text-[15px] font-bold text-foreground truncate">{attendee.full_name}</p>
        {attendee.specialty && (
          <p className="text-[12px] sm:text-[13px] text-muted-foreground truncate">{attendee.specialty}</p>
        )}
        {attendee.institution && (
          <p className="text-[11px] sm:text-[12px] text-muted-foreground truncate">{attendee.institution}</p>
        )}
      </div>
      <div onClick={e => e.stopPropagation()} className="shrink-0">
        {contactStatus === 'none' && (
          <Button variant="outline" size="sm" onClick={onConnect} disabled={isSending} className="text-xs px-2 sm:px-3">
            {t('connect')}
          </Button>
        )}
        {contactStatus === 'sent' && (
          <Button variant="ghost" size="sm" disabled className="text-muted-foreground text-xs px-2 sm:px-3">
            {t('sent')}
          </Button>
        )}
        {contactStatus === 'accepted' && (
          <Button variant="default" size="sm" disabled className="bg-[#00B89F] hover:bg-[#00B89F] text-white text-xs px-2 sm:px-3">
            <Check className="h-3 w-3 mr-1" />
            {t('connected')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Contacts() {
  const { t } = useTranslation('contacts');
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const { attendee } = useAuth();
  const { event } = useEvent();
  const [search, setSearch] = useState('');
  const [participantsPage, setParticipantsPage] = useState(1);
  const [contactsPage, setContactsPage] = useState(1);

  const { data: attendees, isLoading: loadingAttendees } = useEventAttendees(event?.id);
  const { data: contacts, isLoading: loadingContacts } = useMyContacts(attendee?.id);
  const sendRequest = useSendContactRequest();
  const acceptContact = useAcceptContact();
  const rejectContact = useRejectContact();
  const cancelRequest = useCancelContactRequest();

  const myId = attendee?.id;

  const contactMap = useMemo(() => {
    const map = new Map<string, { status: 'sent' | 'received' | 'accepted'; row: ContactRow }>();
    if (!contacts || !myId) return map;
    for (const c of contacts) {
      const otherId = c.user_id === myId ? c.contact_id : c.user_id;
      if (c.status === 'accepted') {
        map.set(otherId, { status: 'accepted', row: c });
      } else if (c.status === 'pending') {
        map.set(otherId, { status: c.user_id === myId ? 'sent' : 'received', row: c });
      }
    }
    return map;
  }, [contacts, myId]);

  const filteredAttendees = useMemo(() => {
    if (!attendees) return [];
    const q = search.toLowerCase();
    return attendees
      .filter(a => a.id !== myId)
      .filter(a =>
        !q ||
        a.full_name.toLowerCase().includes(q) ||
        (a.specialty?.toLowerCase().includes(q) ?? false) ||
        (a.institution?.toLowerCase().includes(q) ?? false)
      );
  }, [attendees, search, myId]);

  // Reset to page 1 when filter result shrinks
  useEffect(() => { setParticipantsPage(1); }, [filteredAttendees.length]);

  const participantsTotalPages = Math.max(1, Math.ceil(filteredAttendees.length / PAGE_SIZE));
  const paginatedParticipants = useMemo(() => {
    const start = (participantsPage - 1) * PAGE_SIZE;
    return filteredAttendees.slice(start, start + PAGE_SIZE);
  }, [filteredAttendees, participantsPage]);

  const pendingRequests = useMemo(() => {
    if (!contacts || !myId || !attendees) return [];
    return contacts
      .filter(c => c.status === 'pending' && c.contact_id === myId)
      .map(c => {
        const other = attendees?.find(a => a.id === c.user_id);
        return { contact: c, attendee: other };
      })
      .filter(r => r.attendee);
  }, [contacts, myId, attendees]);

  const sentRequests = useMemo(() => {
    if (!contacts || !myId || !attendees) return [];
    return contacts
      .filter(c => c.status === 'pending' && c.user_id === myId)
      .map(c => {
        const other = attendees?.find(a => a.id === c.contact_id);
        return { contact: c, attendee: other };
      })
      .filter(r => r.attendee);
  }, [contacts, myId, attendees]);

  const acceptedContacts = useMemo(() => {
    if (!contacts || !myId || !attendees) return [];
    return contacts
      .filter(c => c.status === 'accepted')
      .map(c => {
        const otherId = c.user_id === myId ? c.contact_id : c.user_id;
        const other = attendees?.find(a => a.id === otherId);
        return { contact: c, attendee: other };
      })
      .filter(r => r.attendee);
  }, [contacts, myId, attendees]);

  useEffect(() => { setContactsPage(1); }, [acceptedContacts.length]);
  const contactsTotalPages = Math.max(1, Math.ceil(acceptedContacts.length / PAGE_SIZE));
  const paginatedAccepted = useMemo(() => {
    const start = (contactsPage - 1) * PAGE_SIZE;
    return acceptedContacts.slice(start, start + PAGE_SIZE);
  }, [acceptedContacts, contactsPage]);

  const handleConnect = (contactId: string) => {
    if (!event?.id || !myId) return;
    sendRequest.mutate({ eventId: event.id, userId: myId, contactId });
  };

  const goToProfile = (attendeeId: string) => {
    navigate(`/${eventSlug}/contacts/${attendeeId}`);
  };

  return (
    <div className="pb-4">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <Tabs defaultValue="participants" className="px-4">
        <TabsList className="w-full">
          <TabsTrigger value="participants" className="flex-1">{t('tabs.participants')}</TabsTrigger>
          <TabsTrigger value="myContacts" className="flex-1">{t('tabs.myContacts')}</TabsTrigger>
        </TabsList>

        {/* TAB 1: Participantes */}
        <TabsContent value="participants">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {loadingAttendees ? (
              Array.from({ length: 4 }).map((_, i) => <ContactSkeleton key={i} />)
            ) : filteredAttendees.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t('noParticipants')}
              </div>
            ) : (
              paginatedParticipants.map(a => {
                const info = contactMap.get(a.id);
                return (
                  <AttendeeCard
                    key={a.id}
                    attendee={a}
                    contactStatus={info?.status ?? 'none'}
                    onConnect={() => handleConnect(a.id)}
                    onTap={() => goToProfile(a.id)}
                    isSending={sendRequest.isPending}
                  />
                );
              })
            )}
          </div>

          <MobilePagination
            currentPage={participantsPage}
            totalPages={participantsTotalPages}
            totalItems={filteredAttendees.length}
            onPageChange={setParticipantsPage}
          />
        </TabsContent>

        {/* TAB 2: Mis Contactos */}
        <TabsContent value="myContacts">
          {loadingContacts || loadingAttendees ? (
            Array.from({ length: 3 }).map((_, i) => <ContactSkeleton key={i} />)
          ) : (
            <>
              {/* Pending requests */}
              {pendingRequests.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {t('pendingRequests', { count: pendingRequests.length })}
                  </h3>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {pendingRequests.map(({ contact, attendee: a }) => (
                      <div key={contact.id} className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border last:border-b-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A56A0] text-white text-sm font-semibold">
                          {getInitials(a!.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] sm:text-[15px] font-bold text-foreground truncate">{a!.full_name}</p>
                          {a!.specialty && (
                            <p className="text-[12px] sm:text-[13px] text-muted-foreground truncate">{a!.specialty}</p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 shrink-0">
                          <Button size="sm" className="bg-[#00B89F] hover:bg-[#00a08a] text-white text-xs px-2 sm:px-3" onClick={() => acceptContact.mutate(contact.id)}>
                            {t('accept')}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs px-2 sm:px-3" onClick={() => rejectContact.mutate(contact.id)}>
                            {t('reject')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sent requests */}
              {sentRequests.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {t('sentRequests', { count: sentRequests.length })}
                  </h3>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {sentRequests.map(({ contact, attendee: a }) => (
                      <div key={contact.id} className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border last:border-b-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A56A0] text-white text-sm font-semibold">
                          {getInitials(a!.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] sm:text-[15px] font-bold text-foreground truncate">{a!.full_name}</p>
                          {a!.specialty && (
                            <p className="text-[12px] sm:text-[13px] text-muted-foreground truncate">{a!.specialty}</p>
                          )}
                          <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            {t('sent')}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs px-2 sm:px-3 shrink-0" onClick={() => cancelRequest.mutate(contact.id)} disabled={cancelRequest.isPending}>
                          {t('cancel')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {acceptedContacts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <UserCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>{t('noContacts')}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {paginatedAccepted.map(({ attendee: a }) => (
                      <div
                        key={a!.id}
                        className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => goToProfile(a!.id)}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A56A0] text-white text-sm font-semibold">
                          {getInitials(a!.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] sm:text-[15px] font-bold text-foreground truncate">{a!.full_name}</p>
                          {a!.specialty && (
                            <p className="text-[12px] sm:text-[13px] text-muted-foreground truncate">{a!.specialty}</p>
                          )}
                          {a!.institution && (
                            <p className="text-[11px] sm:text-[12px] text-muted-foreground truncate">{a!.institution}</p>
                          )}
                        </div>
                        <Button variant="outline" size="sm" className="text-xs px-2 sm:px-3 shrink-0" onClick={e => { e.stopPropagation(); goToProfile(a!.id); }}>
                          {t('viewProfile')}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <MobilePagination
                    currentPage={contactsPage}
                    totalPages={contactsTotalPages}
                    totalItems={acceptedContacts.length}
                    onPageChange={setContactsPage}
                  />
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
