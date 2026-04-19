import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useEventAttendees } from '@/hooks/useContacts';
import {
  useDirectConversations,
  useCreateDirectConversation,
  useAcceptConversation,
  useRejectConversation,
} from '@/hooks/useMessaging';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePendingMessages } from '@/hooks/usePendingMessages';
import type { DirectConversation } from '@/services/messaging.service';

interface Props {
  onSelectConversation: (conv: DirectConversation) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function DirectConversationList({ onSelectConversation }: Props) {
  const { t } = useTranslation('messaging');
  const { attendee } = useAuth();
  const { event } = useEvent();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const eventId = event?.id ?? '';
  const attendeeId = attendee?.id ?? '';

  const { data: conversations = [], isLoading } = useDirectConversations(eventId, attendeeId);
  const acceptMutation = useAcceptConversation();
  const rejectMutation = useRejectConversation();
  const { pending: allPending } = usePendingMessages();

  // Count pending messages by conversation id
  const pendingByConv: Record<string, number> = {};
  for (const p of allPending) {
    pendingByConv[p.conversationId] = (pendingByConv[p.conversationId] ?? 0) + 1;
  }

  // Realtime: refresh list on conversation/message changes for this event
  useEffect(() => {
    if (!eventId || !attendeeId || !isOnline) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['direct-conversations', eventId, attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages', eventId] });
    };

    const channel = supabase
      .channel(`conv-list-${eventId}-${attendeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `event_id=eq.${eventId}`,
        },
        invalidate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, attendeeId, isOnline, queryClient]);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const pendingInvites = conversations.filter(
    c => c.status === 'pending' && c.participant_id === attendeeId
  );
  const sentPending = conversations.filter(
    c => c.status === 'pending' && c.initiated_by === attendeeId
  );
  const activeConvos = conversations.filter(c => c.status === 'active');

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => setShowNewDialog(true)}
          className="bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white ml-auto"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('newConversation')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {t('pendingInvites')}
            </h3>
            <div className="space-y-2">
              {pendingInvites.map(c => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {getInitials(c.other_name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.other_name}</p>
                      <p className="text-xs text-muted-foreground">{t('wantsToChat')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => rejectMutation.mutate(c.id)}
                      disabled={rejectMutation.isPending}
                    >
                      {t('rejectInvite')}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white"
                      onClick={() =>
                        acceptMutation.mutate(c.id, {
                          onSuccess: () => onSelectConversation({ ...c, status: 'active' }),
                        })
                      }
                      disabled={acceptMutation.isPending}
                    >
                      {t('acceptInvite')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent pending */}
        {sentPending.map(c => (
          <button
            key={c.id}
            onClick={() => onSelectConversation(c)}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-muted-foreground">
                {getInitials(c.other_name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground truncate">{c.other_name}</p>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {t('pendingBadge')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{t('waitingAccept')}</p>
            </div>
          </button>
        ))}

        {/* Active conversations */}
        {activeConvos.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {t('myConversations')}
            </h3>
            <div className="space-y-2">
              {activeConvos.map(c => {
                const pendingCount = pendingByConv[c.id] ?? 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectConversation(c)}
                    className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {getInitials(c.other_name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{c.other_name}</p>
                        {c.last_message_at && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {new Date(c.last_message_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {c.last_message_preview ? (
                          <p className="text-xs text-muted-foreground truncate">{c.last_message_preview}</p>
                        ) : <span className="flex-1" />}
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {t('pendingCount', { count: pendingCount })}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {conversations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-foreground font-medium">{t('noConversations')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('noConversationsSub')}</p>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        existingConversations={conversations}
      />
    </div>
  );
}

// ── New Conversation Dialog ───────────────────────────────────

function NewConversationDialog({
  open,
  onOpenChange,
  existingConversations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConversations: DirectConversation[];
}) {
  const { t } = useTranslation('messaging');
  const { attendee } = useAuth();
  const { event } = useEvent();
  const eventId = event?.id ?? '';
  const attendeeId = attendee?.id ?? '';

  const { data: allAttendees = [] } = useEventAttendees(eventId);
  const createMutation = useCreateDirectConversation();
  const [search, setSearch] = useState('');

  const existingOtherIds = new Set(existingConversations.map(c => c.other_id));

  const filtered = allAttendees.filter(a => {
    if (a.id === attendeeId) return false;
    if (existingOtherIds.has(a.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.full_name.toLowerCase().includes(q) || (a.email?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const handleSelect = useCallback(
    (targetId: string) => {
      if (!event) return;
      createMutation.mutate(
        {
          eventId,
          initiatorId: attendeeId,
          participantId: targetId,
          organizationId: (event as any).organization_id,
        },
        { onSuccess: () => { setSearch(''); onOpenChange(false); } }
      );
    },
    [eventId, attendeeId, event, createMutation, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('newConversation')}</DialogTitle>
          <DialogDescription>{t('selectAttendee')}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchAttendees')}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="space-y-1">
            {filtered.map(a => (
              <button
                key={a.id}
                onClick={() => handleSelect(a.id)}
                disabled={createMutation.isPending}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {getInitials(a.full_name)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.full_name}</p>
                  {a.specialty && (
                    <p className="text-xs text-muted-foreground truncate">{a.specialty}</p>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('noConversationsSub')}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
