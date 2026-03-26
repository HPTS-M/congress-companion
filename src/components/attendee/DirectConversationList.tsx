import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useEventAttendees } from '@/hooks/useContacts';
import {
  useDirectConversations,
  useCreateDirectConversation,
} from '@/hooks/useMessaging';
import { Search, Plus, X } from 'lucide-react';
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
import type { DirectConversation } from '@/services/messaging.service';

interface Props {
  onSelectConversation: (conv: DirectConversation) => void;
}

export default function DirectConversationList({ onSelectConversation }: Props) {
  const { t } = useTranslation('messaging');
  const { attendee } = useAuth();
  const { event } = useEvent();
  const eventId = event?.id ?? '';
  const attendeeId = attendee?.id ?? '';

  const { data: conversations = [], isLoading } = useDirectConversations(eventId, attendeeId);
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
      {/* Header bar */}
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
          <InviteSection invites={pendingInvites} onSelect={onSelectConversation} />
        )}

        {/* Sent pending */}
        {sentPending.length > 0 && (
          <div className="space-y-2">
            {sentPending.map(c => (
              <ConversationItem
                key={c.id}
                conversation={c}
                onClick={() => onSelectConversation(c)}
                isPendingSent
              />
            ))}
          </div>
        )}

        {/* Active conversations */}
        {activeConvos.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {t('myConversations')}
            </h3>
            <div className="space-y-2">
              {activeConvos.map(c => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  onClick={() => onSelectConversation(c)}
                />
              ))}
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

// ── Invite section ────────────────────────────────────────────

function InviteSection({
  invites,
  onSelect,
}: {
  invites: DirectConversation[];
  onSelect: (c: DirectConversation) => void;
}) {
  const { t } = useTranslation('messaging');
  const acceptMutation = (await import('@/hooks/useMessaging')).useAcceptConversation;

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        {t('pendingInvites')}
      </h3>
      <div className="space-y-2">
        {invites.map(c => (
          <InviteCard key={c.id} conversation={c} onAccepted={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
}

function InviteCard({ conversation, onAccepted }: { conversation: DirectConversation; onAccepted: () => void }) {
  const { t } = useTranslation('messaging');
  const { useAcceptConversation, useRejectConversation } = require('@/hooks/useMessaging');
  const accept = useAcceptConversation();
  const reject = useRejectConversation();

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-muted-foreground">
            {getInitials(conversation.other_name)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{conversation.other_name}</p>
          <p className="text-xs text-muted-foreground">{t('wantsToChat')}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => reject.mutate(conversation.id)}
          disabled={reject.isPending}
        >
          {t('rejectInvite')}
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white"
          onClick={() => accept.mutate(conversation.id, { onSuccess: onAccepted })}
          disabled={accept.isPending}
        >
          {t('acceptInvite')}
        </Button>
      </div>
    </div>
  );
}

// ── Conversation item ─────────────────────────────────────────

function ConversationItem({
  conversation,
  onClick,
  isPendingSent,
}: {
  conversation: DirectConversation;
  onClick: () => void;
  isPendingSent?: boolean;
}) {
  const { t } = useTranslation('messaging');

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-muted-foreground">
          {getInitials(conversation.other_name)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground truncate">{conversation.other_name}</p>
          {isPendingSent ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {t('pendingBadge')}
            </span>
          ) : conversation.last_message_at ? (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {new Date(conversation.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
        {isPendingSent ? (
          <p className="text-xs text-muted-foreground truncate">{t('waitingAccept')}</p>
        ) : conversation.last_message_preview ? (
          <p className="text-xs text-muted-foreground truncate">{conversation.last_message_preview}</p>
        ) : null}
      </div>
    </button>
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
      return a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
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
          organizationId: event.organization_id,
        },
        { onSuccess: () => onOpenChange(false) }
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
