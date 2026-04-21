import { useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DirectConversation } from '@/services/messaging.service';

/**
 * Shows an in-app toast when a new direct message is received.
 *  - Listens to chat_messages INSERT (no event_id filter — filtered client-side).
 *  - Skips if the message is from the current attendee.
 *  - Skips if the conversation isn't one of mine (cache check).
 *  - Skips if the user is currently viewing that conversation
 *    (DirectChatView dispatches `dm:opened` / `dm:closed` window events).
 *  - Deduplicates by message id.
 *
 * Native push notifications are handled by the `send-message-push` Edge Function;
 * this hook only adds the in-app fallback when the app is in the foreground.
 */
export function useDirectMessageToasts(): void {
  const { attendee } = useAuth();
  const eventId = attendee?.event_id;
  const attendeeId = attendee?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation('messaging');

  const seenIdsRef = useRef<Set<string>>(new Set());
  const openConvIdRef = useRef<string | null>(null);

  // Track which DM conversation is currently open (mounted DirectChatView).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') openConvIdRef.current = detail;
    };
    const onClose = () => {
      openConvIdRef.current = null;
    };
    window.addEventListener('dm:opened', onOpen as EventListener);
    window.addEventListener('dm:closed', onClose as EventListener);
    return () => {
      window.removeEventListener('dm:opened', onOpen as EventListener);
      window.removeEventListener('dm:closed', onClose as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!eventId || !attendeeId) return;

    const channel = supabase
      .channel(`dm-toasts:${attendeeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const id = row.id as string | undefined;
          const conversationId = row.conversation_id as string | undefined;
          const senderId = row.sender_id as string | undefined;
          const content = (row.content as string | undefined) ?? '';

          if (!id || !conversationId || !senderId) return;

          // Ignore our own messages
          if (senderId === attendeeId) return;

          // Dedupe (Realtime can deliver twice on reconnects)
          if (seenIdsRef.current.has(id)) return;

          // Skip if conversation isn't part of my list (other event, etc.)
          const conversations = queryClient.getQueryData<DirectConversation[]>([
            'direct-conversations',
            eventId,
            attendeeId,
          ]);
          const conv = conversations?.find((c) => c.id === conversationId);
          if (!conv) return;

          // Only toast for active conversations (pending → handled by badge)
          if (conv.status !== 'active') return;

          // Skip if user has this conversation open
          if (openConvIdRef.current === conversationId) {
            seenIdsRef.current.add(id);
            return;
          }

          seenIdsRef.current.add(id);

          const slug = params.eventSlug;
          toast(conv.other_name, {
            description: content.slice(0, 120),
            action: slug
              ? {
                  label: t('toast.viewAction'),
                  onClick: () => navigate(`/${slug}/messaging`),
                }
              : undefined,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, attendeeId, queryClient, navigate, location.pathname, params.eventSlug, t]);
}
