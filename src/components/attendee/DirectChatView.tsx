import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useDirectMessages, useAttendeeNames, useDeleteConversation, useMarkDelivered } from '@/hooks/useMessaging';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingMessages } from '@/hooks/usePendingMessages';
import { messagingService, type ChatMessage, type DirectConversation, type ReplyToPreview } from '@/services/messaging.service';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ArrowLeft, Send, Trash2, MessageSquare, Clock, AlertTriangle, Loader2, Check, CheckCheck, Reply, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PendingMessage } from '@/lib/pending-messages';

interface Props {
  conversation: DirectConversation;
  onBack: () => void;
}

type DisplayMessage = ChatMessage & { __pending?: PendingMessage };

const QUOTE_PREVIEW_MAX = 120;

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

function truncate(s: string, max = QUOTE_PREVIEW_MAX): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Smoothly scroll to a quoted message and flash-highlight it.
 * If the original message is not in the DOM, surface a friendly toast.
 */
function scrollToMessage(id: string, onMissing: () => void): void {
  const el = document.getElementById(`msg-${id}`);
  if (!el) {
    onMissing();
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.setAttribute('data-flash', 'true');
  window.setTimeout(() => el.removeAttribute('data-flash'), 1500);
}

// ── Quoted preview block (XSS-safe: plain text only) ──────────
interface QuoteBlockProps {
  reply: ReplyToPreview;
  isOwn: boolean;
  resolveName: (id: string) => string;
  onTap: () => void;
}

const QuoteBlock = memo(function QuoteBlock({ reply, isOwn, resolveName, onTap }: QuoteBlockProps) {
  const { t } = useTranslation('messaging');
  const senderLabel = reply.was_deleted ? '' : resolveName(reply.sender_id);
  const previewText = reply.was_deleted ? t('messageDeleted') : truncate(reply.content);

  const baseClasses = isOwn
    ? 'bg-white/15 border-l-2 border-white/70 text-white/90'
    : 'bg-background/70 dark:bg-slate-900/40 border-l-2 border-primary/70 text-foreground/85';

  return (
    <button
      type="button"
      onClick={onTap}
      className={`w-full text-left mb-1 rounded-md px-2 py-1.5 ${baseClasses} hover:opacity-90 transition-opacity`}
    >
      {senderLabel && (
        <div className={`text-[11px] font-semibold ${isOwn ? 'text-white' : 'text-primary'}`}>
          {senderLabel}
        </div>
      )}
      <div
        className={`text-[12px] line-clamp-2 whitespace-pre-wrap break-words ${
          reply.was_deleted ? 'italic opacity-70' : ''
        }`}
      >
        {previewText}
      </div>
    </button>
  );
});

// ── Single message bubble (memoized to avoid full-list re-renders) ─
interface BubbleProps {
  msg: DisplayMessage;
  isOwn: boolean;
  senderName: string;
  resolveName: (id: string) => string;
  onReply: (msg: DisplayMessage) => void;
  onCopy: (content: string) => void;
  onJumpToQuote: (id: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (pendingId: string) => void;
}

const MessageBubble = memo(
  function MessageBubble({
    msg,
    isOwn,
    senderName,
    resolveName,
    onReply,
    onCopy,
    onJumpToQuote,
    onRetry,
    onDiscard,
  }: BubbleProps) {
    const { t } = useTranslation('messaging');
    const [menuOpen, setMenuOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const longPressTimer = useRef<number | null>(null);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    const pendingInfo = msg.__pending;
    const isFailed = pendingInfo?.status === 'failed';
    const isSending = pendingInfo?.status === 'sending';
    const isQueued = pendingInfo?.status === 'pending';
    const isRealMessage = !pendingInfo && !msg.id.startsWith('temp-');
    // Allow opening menu on real messages OR pending entries (any status).
    // Sending shows only "Copy" to avoid race conditions with the worker.
    const canOpenMenu = isRealMessage || !!pendingInfo;
    const canDiscard = isFailed || isQueued;

    // Long-press detection (mobile). Threshold cancels accidental scrolls.
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!canOpenMenu) return;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = window.setTimeout(() => {
        if ('vibrate' in navigator) {
          try { navigator.vibrate(40); } catch { /* noop */ }
        }
        setMenuOpen(true);
      }, 500);
    };

    const cancelLongPress = () => {
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStartPos.current = null;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStartPos.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) cancelLongPress();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      if (!canOpenMenu) return;
      e.preventDefault();
      setMenuOpen(true);
    };

    // For pending/failed bubbles, a short tap opens the actions menu
    // (retry + discard). Without this, on mobile the only way in was a
    // long-press, which users didn't discover.
    const handleBubbleClick = (e: React.MouseEvent) => {
      if (!pendingInfo) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(true);
    };

    const handleReplyClick = () => {
      setMenuOpen(false);
      onReply(msg);
    };

    const handleCopyClick = () => {
      setMenuOpen(false);
      onCopy(msg.content);
    };

    const handleRetryClick = () => {
      setMenuOpen(false);
      if (pendingInfo) onRetry(pendingInfo.id);
    };

    const handleDiscardClick = () => {
      setMenuOpen(false);
      setDiscardOpen(true);
    };

    const confirmDiscard = () => {
      if (pendingInfo) onDiscard(pendingInfo.id);
      setDiscardOpen(false);
    };

    return (
      <div id={`msg-${msg.id}`} className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
        {!isOwn && (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {getInitials(senderName)}
            </span>
          </div>
        )}
        <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col group relative`}>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                aria-label={t('messageActions')}
                onTouchStart={handleTouchStart}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onTouchMove={handleTouchMove}
                onContextMenu={handleContextMenu}
                className={`chat-bubble-press cursor-pointer px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  isOwn
                    ? 'bg-[hsl(213,72%,37%)] text-white rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                } ${pendingInfo ? 'opacity-80' : ''}`}
              >
                {msg.reply_to && (
                  <QuoteBlock
                    reply={msg.reply_to}
                    isOwn={isOwn}
                    resolveName={resolveName}
                    onTap={() => onJumpToQuote(msg.reply_to!.id)}
                  />
                )}
                {msg.content}
              </div>
            </DropdownMenuTrigger>
            {canOpenMenu && (
              <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="min-w-[160px]">
                {isRealMessage && (
                  <DropdownMenuItem onClick={handleReplyClick} aria-label={t('replyAriaLabel')}>
                    <Reply className="h-4 w-4 mr-2" />
                    {t('reply')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleCopyClick}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('copy')}
                </DropdownMenuItem>
                {isFailed && (
                  <DropdownMenuItem onClick={handleRetryClick}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {t('tapToRetry')}
                  </DropdownMenuItem>
                )}
                {canDiscard && (
                  <DropdownMenuItem
                    onClick={handleDiscardClick}
                    className="text-destructive focus:text-destructive"
                    aria-label={t('discard')}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('discard')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            )}
          </DropdownMenu>

          <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('discardConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('discardConfirmBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('discardCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDiscard}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('discardConfirmAction')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Desktop hover reply shortcut */}
          {isRealMessage && (
            <button
              type="button"
              onClick={() => onReply(msg)}
              aria-label={t('replyAriaLabel')}
              className={`hidden sm:flex absolute -top-2 ${
                isOwn ? '-left-7' : '-right-7'
              } opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 items-center justify-center rounded-full bg-background border border-border shadow-sm hover:bg-muted`}
            >
              <Reply className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          <span
            className={`text-[11px] mt-0.5 px-1 flex items-center gap-1 ${
              isOwn ? 'text-right justify-end' : ''
            } ${isFailed ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {isFailed ? (
              <button
                type="button"
                onClick={() => pendingInfo && onRetry(pendingInfo.id)}
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
              <>
                {msg.created_at ? formatMessageTime(msg.created_at) : ''}
                {isOwn && !pendingInfo && (
                  msg.delivered_at ? (
                    <CheckCheck
                      className="h-3.5 w-3.5 text-[hsl(170,100%,36%)]"
                      aria-label={t('statusDelivered')}
                    />
                  ) : (
                    <Check
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-label={t('statusSent')}
                    />
                  )
                )}
              </>
            )}
          </span>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.msg.id === next.msg.id &&
    prev.msg.delivered_at === next.msg.delivered_at &&
    prev.msg.content === next.msg.content &&
    prev.msg.reply_to?.id === next.msg.reply_to?.id &&
    prev.msg.reply_to?.was_deleted === next.msg.reply_to?.was_deleted &&
    prev.msg.__pending?.status === next.msg.__pending?.status &&
    prev.senderName === next.senderName
);

export default function DirectChatView({ conversation, onBack }: Props) {
  const { t, i18n } = useTranslation('messaging');
  const { attendee } = useAuth();
  const { event } = useEvent();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
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

  // Stable reference: keeps Realtime subscription effect from re-mounting
  // every render (which would lose UPDATE events during the reconnect window).
  const markDeliveredMutate = markDelivered.mutate;
  const triggerMarkDelivered = useCallback(() => {
    if (!conversation.id || !attendeeId) return;
    markDeliveredMutate({ conversationId: conversation.id, attendeeId });
  }, [conversation.id, attendeeId, markDeliveredMutate]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<DisplayMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPending = conversation.status === 'pending';
  const isInitiator = conversation.initiated_by === attendeeId;

  // Scroll to bottom (also when pending messages are added)
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
          const raw = payload.new as Record<string, unknown>;
          const newMsg: ChatMessage = {
            id: raw.id as string,
            conversation_id: raw.conversation_id as string,
            sender_id: raw.sender_id as string,
            content: raw.content as string,
            created_at: (raw.created_at as string) ?? null,
            delivered_at: (raw.delivered_at as string) ?? null,
            reply_to_id: (raw.reply_to_id as string | null) ?? null,
            reply_to: null, // resolved on next refetch / lookup below
          };
          queryClient.setQueryData<ChatMessage[]>(
            ['direct-messages', conversation.id],
            (old = []) => {
              // Replace optimistic temp message with real one
              // (match by sender + content + reply_to_id to avoid mis-dedupe of duplicate replies).
              const withoutTemp = old.filter(
                m => !(
                  m.id.startsWith('temp-') &&
                  m.sender_id === newMsg.sender_id &&
                  m.content === newMsg.content &&
                  (m.reply_to_id ?? null) === (newMsg.reply_to_id ?? null)
                )
              );
              if (withoutTemp.some(m => m.id === newMsg.id)) return withoutTemp;

              // Resolve reply_to from already-loaded messages so the quote
              // renders immediately (without an extra fetch round-trip).
              if (newMsg.reply_to_id) {
                const original = withoutTemp.find(m => m.id === newMsg.reply_to_id);
                if (original) {
                  newMsg.reply_to = {
                    id: original.id,
                    sender_id: original.sender_id,
                    content: original.content.slice(0, QUOTE_PREVIEW_MAX),
                    was_deleted: false,
                  };
                }
              }
              return [...withoutTemp, newMsg];
            }
          );
          // Refresh conversation list (preview + ordering)
          queryClient.invalidateQueries({ queryKey: ['direct-conversations'] });

          // If the incoming message is from the OTHER party, mark as delivered
          if (attendeeId && newMsg.sender_id !== attendeeId) {
            triggerMarkDelivered();
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
          const updated = payload.new as Partial<ChatMessage> & { id: string };
          queryClient.setQueryData<ChatMessage[]>(
            ['direct-messages', conversation.id],
            (old = []) =>
              old.map(m =>
                m.id === updated.id
                  // Defensive merge: only overwrite delivered_at, preserve
                  // reply_to and any other client-resolved fields.
                  ? { ...m, delivered_at: updated.delivered_at ?? m.delivered_at }
                  : m
              )
          );
          // Safety net: ensure list is fully fresh in case our cache merge
          // missed a field (e.g. a reply_to embed pending resolution).
          queryClient.invalidateQueries({
            queryKey: ['direct-messages', conversation.id],
            refetchType: 'none',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, queryClient, isOnline, realtimeKey, attendeeId, triggerMarkDelivered]);

  // Mark messages as delivered when opening the conversation
  useEffect(() => {
    if (!conversation.id || !attendeeId || !isOnline || conversation.status !== 'active') return;
    triggerMarkDelivered();
  }, [conversation.id, attendeeId, isOnline, conversation.status, triggerMarkDelivered]);

  // Re-mark as delivered when the tab regains focus / becomes visible.
  // Covers the case where messages arrived while the chat was open but the
  // browser tab was in the background (no user interaction would re-fire it).
  useEffect(() => {
    if (!conversation.id || !attendeeId || conversation.status !== 'active') return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        triggerMarkDelivered();
      }
    };
    const onFocus = () => triggerMarkDelivered();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    // Heartbeat: idempotent re-check every 15s while tab is visible.
    // RPC only updates rows where delivered_at IS NULL, so cost is ~zero.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        triggerMarkDelivered();
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [conversation.id, attendeeId, conversation.status, triggerMarkDelivered]);

  // Tell the global DM toast hook this conversation is open so it can suppress
  // both in-app toasts and (via the SW tag) duplicate native notifications.
  useEffect(() => {
    if (!conversation.id) return;
    window.dispatchEvent(new CustomEvent('dm:opened', { detail: conversation.id }));
    return () => {
      window.dispatchEvent(new CustomEvent('dm:closed', { detail: conversation.id }));
    };
  }, [conversation.id]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || isPending) return;
    const content = input.trim();
    const replySnapshot = replyTo;
    setInput('');
    setReplyTo(null);
    setSending(true);

    try {
      // OFFLINE → enqueue immediately. Worker will flush when reconnected.
      if (!isOnline) {
        enqueue({
          conversationId: conversation.id,
          senderId: attendeeId,
          content,
          replyToId: replySnapshot?.id ?? null,
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
        reply_to_id: replySnapshot?.id ?? null,
        reply_to: replySnapshot
          ? {
              id: replySnapshot.id,
              sender_id: replySnapshot.sender_id,
              content: replySnapshot.content.slice(0, QUOTE_PREVIEW_MAX),
              was_deleted: false,
            }
          : null,
      };
      queryClient.setQueryData<ChatMessage[]>(
        ['direct-messages', conversation.id],
        (old = []) => [...old, optimisticMsg]
      );

      try {
        await messagingService.sendMessage(
          conversation.id,
          attendeeId,
          content,
          replySnapshot?.id ?? null
        );
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
          replyToId: replySnapshot?.id ?? null,
        });
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, isPending, isOnline, conversation.id, attendeeId, queryClient, enqueue, replyTo]);

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

  const resolveName = useCallback(
    (id: string) => {
      if (id === attendeeId) return t('you');
      return nameMap[id] || conversation.other_name;
    },
    [attendeeId, nameMap, conversation.other_name, t]
  );

  const handleReply = useCallback((msg: DisplayMessage) => {
    setReplyTo(msg);
    // Focus input so the user can start typing immediately.
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        toast({ title: t('copied') });
      } catch {
        // Clipboard API not available — silently ignore.
      }
    },
    [toast, t]
  );

  const handleJumpToQuote = useCallback(
    (id: string) => {
      scrollToMessage(id, () => {
        toast({ title: t('messageNotInView') });
      });
    },
    [toast, t]
  );

  const handleDiscard = useCallback(
    (pendingId: string) => {
      removePending(pendingId);
      toast({ title: t('messageDiscarded') });
    },
    [removePending, toast, t]
  );
  const pendingAsMessages: DisplayMessage[] = pending.map(p => ({
    id: p.id,
    conversation_id: p.conversationId,
    sender_id: p.senderId,
    content: p.content,
    created_at: p.createdAt,
    delivered_at: null,
    reply_to_id: p.replyToId ?? null,
    reply_to: null,
    __pending: p,
  }));

  // Merge real + pending, dedupe by content+sender (in case realtime already delivered),
  // sort by created_at.
  const merged: DisplayMessage[] = [...messages.map(m => m as DisplayMessage), ...pendingAsMessages]
    .reduce<DisplayMessage[]>((acc, m) => {
      // If this is a pending msg and a real one with same sender+content+replyToId already exists, drop it
      if (m.__pending) {
        const realExists = messages.some(
          r =>
            r.sender_id === m.sender_id &&
            r.content === m.content &&
            (r.reply_to_id ?? null) === (m.reply_to_id ?? null)
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
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={isOwn}
                    senderName={senderName}
                    resolveName={resolveName}
                    onReply={handleReply}
                    onCopy={handleCopy}
                    onJumpToQuote={handleJumpToQuote}
                    onRetry={retry}
                    onDiscard={handleDiscard}
                  />
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

      {/* Reply preview banner */}
      {replyTo && (
        <div className="border-t border-border bg-muted/40 px-3 py-2 flex items-start gap-2">
          <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-primary truncate">
              {t('replying', { name: resolveName(replyTo.sender_id) })}
            </div>
            <div className="text-xs text-muted-foreground truncate whitespace-pre-wrap">
              {truncate(replyTo.content, 80)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={t('cancelReply')}
            onClick={() => setReplyTo(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border px-4 py-3 flex gap-2 bg-background">
        <Input
          ref={inputRef}
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
