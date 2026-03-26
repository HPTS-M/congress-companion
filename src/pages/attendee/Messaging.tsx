import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useGroupConversation, useMessages, useAttendeeNames } from '@/hooks/useMessaging';
import { messagingService } from '@/services/messaging.service';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatMessage } from '@/services/messaging.service';
import type { DirectConversation } from '@/services/messaging.service';
import DirectConversationList from '@/components/attendee/DirectConversationList';
import DirectChatView from '@/components/attendee/DirectChatView';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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

export default function Messaging() {
  const { t, i18n } = useTranslation('messaging');
  const { user, attendee } = useAuth();
  const { event } = useEvent();
  const queryClient = useQueryClient();
  const dateFnsLocale = i18n.language?.startsWith('es') ? es : enUS;

  const eventId = event?.id ?? '';
  const attendeeId = attendee?.id ?? '';

  const { data: conversationId, isLoading: loadingConv } = useGroupConversation(eventId);
  const { data: messages = [], isLoading: loadingMsgs } = useMessages(conversationId ?? null);
  const { data: nameMap = {} } = useAttendeeNames(eventId);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Direct chat state
  const [selectedDirect, setSelectedDirect] = useState<DirectConversation | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Supabase Realtime subscription for group chat
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(
            ['chat-messages', conversationId],
            (old = []) => [...old, newMsg]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Send message (group chat)
  const handleSend = useCallback(async () => {
    if (!input.trim() || !conversationId || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      await messagingService.sendMessage(conversationId, attendeeId, content);
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, conversationId, attendeeId, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach(msg => {
    const dateKey = msg.created_at ? format(new Date(msg.created_at), 'yyyy-MM-dd') : '';
    const last = groupedMessages[groupedMessages.length - 1];
    if (last?.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  const isLoading = loadingConv || loadingMsgs;

  return (
    <div className="flex flex-col h-[calc(100vh-128px)]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      </div>

      <Tabs defaultValue="group" className="flex flex-col flex-1 min-h-0">
        <div className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="group" className="flex-1">{t('tabs.groupChat')}</TabsTrigger>
            <TabsTrigger value="direct" className="flex-1">{t('tabs.directMessages')}</TabsTrigger>
          </TabsList>
        </div>

        {/* GROUP CHAT TAB */}
        <TabsContent value="group" className="flex-1 flex flex-col min-h-0 mt-0">
          {isLoading ? (
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
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{t('empty')}</p>
              </div>
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
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
                    const senderName = nameMap[msg.sender_id] || 'Asistente';
                    const initials = getInitials(senderName);
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                      >
                        {!isOwn && (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {initials}
                            </span>
                          </div>
                        )}
                        <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!isOwn && (
                            <span className="text-[13px] font-semibold text-foreground mb-0.5 px-1">
                              {senderName}
                            </span>
                          )}
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm ${
                              isOwn
                                ? 'bg-[hsl(213,72%,37%)] text-white rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <span className={`text-[11px] text-muted-foreground mt-0.5 px-1 ${isOwn ? 'text-right' : ''}`}>
                            {msg.created_at ? formatMessageTime(msg.created_at) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
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
              disabled={!conversationId}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sending || !conversationId}
              className="bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        {/* DIRECT MESSAGES TAB — rebuilt */}
        <TabsContent value="direct" className="flex-1 flex flex-col min-h-0 mt-0">
          {selectedDirect ? (
            <DirectChatView
              conversation={selectedDirect}
              onBack={() => setSelectedDirect(null)}
            />
          ) : (
            <DirectConversationList
              onSelectConversation={setSelectedDirect}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
