import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useDirectMessages, useAttendeeNames, useDeleteConversation, useMarkDelivered } from '@/hooks/useMessaging';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingMessages } from '@/hooks/usePendingMessages';
import { messagingService, type ChatMessage, type DirectConversation } from '@/services/messaging.service';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ArrowLeft, Send, Trash2, MessageSquare, Clock, AlertTriangle, Loader2, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { PendingMessage } from '@/lib/pending-messages';

interface Props {
  conversation: DirectConversation;
  onBack: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm');
}

function formatDateLabel(dateStr: string, t: (key: string) => string, locale: typeof es): string {
  const d = new Date(dateStr);
  if (isToday(d)) return t('today');
  if (isYesterday(d)) return t('yesterday');
  return format(d, 'dd MMM yyyy', { locale });
}

export default function DirectChatView({ conversation, onBack }: Props) {
  const { t, i18n } = useTranslation('messaging');
  const { attendee } = useAuth();
  const { event } = useEvent();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const dateFnsLocale = i18n.language?.startsWith('es') ? es : enUS;
  const attendeeId = attendee?.id ?? '';
  const eventId = event?.id ?? '';

  const { data: messages = [], isLoading } = useDirectMessages(
    conversation.status === 'active' ? conversation.id : null
  );
  const { data: nameMap = {} } = useAttendeeNames(eventId);
  const deleteMutation = useDeleteConversation();
  const markDelivered = useMarkDelivered();
  const { pending, enqueue, retry, remove: removePending } = usePendingMessages(conversation.id);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPending = conversation.status === 'pending';
  const isInitiator = conversation.initiated_by === attendeeId;

  // Scroll to bottom (also when pending messages are added)
  const mergedLengthRef = useRef(0);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending.length]);

  // Realtime for direct messages — subscribe whenever conversation exists.
  // We re-subscribe on `attendee:reconnected` to recover from dropped channels
  // after a connectivity blip.
  const [realtimeKey, setRealtimeKey] = useState(0);
  useEffect(() => {
    const onReconnect = () => setRealtimeKey(k => k + 1);
    window.addEventListener('attendee:reconnected', onReconnect);
    return () => window.removeEventListener('attendee:reconnected', onReconnect);
  }, []);

  useEffect(() => {
    if (!conversation.id || !isOnline) return;

    const channel = supabase
      .channel(`dm-${conversation.id}-${realtimeKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(
            ['direct-messages', conversation.id],
            (old = []) => {
              // Replace optimistic temp message with real one (match by sender+content)
              const withoutTemp = old.filter(
                m => !(m.id.startsWith('temp-') && m.sender_id === newMsg.sender_id && m.content === newMsg.content)
              );
              if (withoutTemp.some(m => m.id === newMsg.id)) return withoutTemp;
              return [...withoutTemp, newMsg];
            }
          );
          // Refresh conversation list (preview + ordering)
          queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });

          // If the incoming message is from the OTHER party, mark as delivered
          if (attendeeId && newMsg.sender_id !== attendeeId) {
            markDelivered.mutate({ conversationId: conversation.id, attendeeId });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(
            ['direct-messages', conversation.id],
            (old = []) =>
              old.map(m =>
                m.id === updated.id
                  ? { ...m, delivered_at: updated.delivered_at }
                  : m
              )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, queryClient, isOnline, realtimeKey, attendeeId, markDelivered]);

  // Mark messages as delivered when opening the conversation
  useEffect(() => {
    if (!conversation.id || !attendeeId || !isOnline || conversation.status !== 'active') return;
    markDelivered.mutate({ conversationId: conversation.id, attendeeId });
    // Only when opening / when connectivity returns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, attendeeId, isOnline, conversation.status]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || isPending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      // OFFLINE → enqueue immediately. Worker will flush when reconnected.
      if (!isOnline) {
        enqueue({
          conversationId: conversation.id,
          senderId: attendeeId,
          content,
        });
        return;
      }

      // ONLINE → try direct send with optimistic update.
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMsg: ChatMessage = {
        id: tempId,
        conversation_id: conversation.id,
        sender_id: attendeeId,
        content,
        created_at: new Date().toISOString(),
        delivered_at: null,
      };
      queryClient.setQueryData<ChatMessage[]>(
        ['direct-messages', conversation.id],
        (old = []) => [...old, optimisticMsg]
      );

      try {
        await messagingService.sendMessage(conversation.id, attendeeId, content);
      } catch {
        // Network/server error → rollback optimistic + enqueue for retry
        queryClient.setQueryData<ChatMessage[]>(
          ['direct-messages', conversation.id],
          (old = []) => old.filter(m => m.id !== tempId)
        );
        enqueue({
          conversationId: conversation.id,
          senderId: attendeeId,
          content,
        });
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, isPending, isOnline, conversation.id, attendeeId, queryClient, enqueue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { conversationId: conversation.id, attendeeId, isInitiator },
      { onSuccess: onBack }
    );
  };

  // Pending msgs converted to ChatMessage shape (with kind tag) for unified rendering.
  type DisplayMessage = ChatMessage & { __pending?: PendingMessage };
  const pendingAsMessages: DisplayMessage[] = pending.map(p => ({
    id: p.id,
    conversation_id: p.conversationId,
    sender_id: p.senderId,
    content: p.content,
    created_at: p.createdAt,
    delivered_at: null,
    __pending: p,
  }));

  // Merge real + pending, dedupe by content+sender (in case realtime already delivered),
  // sort by created_at.
  const merged: DisplayMessage[] = [...messages.map(m => m as DisplayMessage), ...pendingAsMessages]
    .reduce<DisplayMessage[]>((acc, m) => {
      // If this is a pending msg and a real one with same sender+content already exists, drop it
      if (m.__pending) {
        const realExists = messages.some(
          r => r.sender_id === m.sender_id && r.content === m.content
        );
        if (realExists) {
          // Real arrived → clean up the pending entry async (don't block render)
          setTimeout(() => removePending(m.__pending!.id), 0);
          return acc;
        }
      }
      acc.push(m);
      return acc;
    }, [])
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  // Group merged messages by date
  const groupedMessages: { date: string; msgs: DisplayMessage[] }[] = [];
  merged.forEach(msg => {
    const dateKey = msg.created_at ? format(new Date(msg.created_at), 'yyyy-MM-dd') : '';
    const last = groupedMessages[groupedMessages.length - 1];
    if (last?.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">
            {getInitials(conversation.other_name)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{conversation.other_name}</p>
          {isPending && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400">{t('pendingBadge')}</span>
          )}
        </div>
        {conversation.status === 'active' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteConversation')}</AlertDialogTitle>
                <AlertDialogDescription>{t('confirmDelete')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('back')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>{t('deleteConversation')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Messages area */}
      {isPending ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {isInitiator ? t('waitingAccept') : t('wantsToChat')}
            </p>
          </div>
        </div>
      ) : merged.length > 0 ? (
        // PRIORITY: if we have anything to show (real OR pending), render the list.
        // This guarantees offline-enqueued messages are visible even when the
        // server query is still loading or has failed due to no connectivity.
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[11px] text-muted-foreground bg-muted px-3 py-0.5 rounded-full">
                  {group.msgs[0]?.created_at
                    ? formatDateLabel(group.msgs[0].created_at, t, dateFnsLocale)
                    : ''}
                </span>
              </div>
              {group.msgs.map(msg => {
                const isOwn = msg.sender_id === attendeeId;
                const senderName = nameMap[msg.sender_id] || conversation.other_name;
                const pendingInfo = msg.__pending;
                const isFailed = pendingInfo?.status === 'failed';
                const isSending = pendingInfo?.status === 'sending';
                const isQueued = pendingInfo?.status === 'pending';
                return (
                  <div key={msg.id} className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {!isOwn && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {getInitials(senderName)}
                        </span>
                      </div>
                    )}
                    <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm ${
                          isOwn
                            ? 'bg-[hsl(213,72%,37%)] text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        } ${pendingInfo ? 'opacity-80' : ''}`}
                      >
                        {msg.content}
                      </div>
                      <span
                        className={`text-[11px] mt-0.5 px-1 flex items-center gap-1 ${
                          isOwn ? 'text-right justify-end' : ''
                        } ${isFailed ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {isFailed ? (
                          <button
                            type="button"
                            onClick={() => retry(pendingInfo!.id)}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {t('tapToRetry')}
                          </button>
                        ) : isSending ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('sendingMessage')}
                          </>
                        ) : isQueued ? (
                          <>
                            <Clock className="h-3 w-3" />
                            {t('pendingMessage')}
                          </>
                        ) : (
                          msg.created_at ? formatMessageTime(msg.created_at) : ''
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      ) : isLoading ? (
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-48 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('noMessages')}</p>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border px-4 py-3 flex gap-2 bg-background">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          className="flex-1"
          disabled={isPending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || sending || isPending}
          className="bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
