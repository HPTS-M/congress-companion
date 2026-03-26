

## Remove Group Chat Tab from Messaging Screen

### Summary
Strip the "Chat General" tab from the attendee Messaging screen, leaving only the direct messaging system. No tabs needed — the screen renders the conversation list or active chat directly.

### Changes

#### 1. `src/pages/attendee/Messaging.tsx` — Simplify to direct-only
- Remove all imports related to group chat: `useGroupConversation`, `useMessages`, `useAttendeeNames`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Send`, `MessageSquare`, `Input`, `Skeleton`, `supabase`, `format`/`isToday`/`isYesterday`, `date-fns` locales, `useQueryClient`, `ChatMessage`
- Remove helper functions `getInitials`, `formatMessageTime`, `formatDateLabel`
- Remove all group chat state (`input`, `sending`, `messagesEndRef`, `scrollRef`, `conversationId`, `messages`, `nameMap`, realtime subscription, `handleSend`, `handleKeyDown`, `groupedMessages`)
- Keep only: `selectedDirect` state, `useAuth`, `useEvent`, `useTranslation`
- Render directly: header + conditional `DirectChatView` or `DirectConversationList` (no Tabs wrapper)

#### 2. `src/services/messaging.service.ts` — Remove group methods
- Remove `getGroupConversation` method
- Keep `getMessages`, `sendMessage`, `getAttendeeNames` (used by direct chat components)
- Remove the "Group Chat" comment section header

#### 3. `src/hooks/useMessaging.ts` — Remove group hooks
- Remove `useGroupConversation` hook
- Remove `useMessages` hook (direct chat uses `useDirectMessages` instead)
- Keep `useAttendeeNames` (may be used elsewhere) and all direct chat hooks

#### 4. `src/locales/es/messaging.json` — Remove tab keys
- Remove `tabs.groupChat` and `tabs.directMessages`
- Remove `empty` key (was for group chat empty state)
- Keep all direct messaging keys

#### 5. `src/locales/en/messaging.json` — Same removals
- Remove `tabs.groupChat` and `tabs.directMessages`
- Remove `empty` key

#### Not touched
- Admin Communications module (keeps its own chat moderation)
- Database tables — no changes
- `DirectConversationList.tsx` and `DirectChatView.tsx` — no changes

