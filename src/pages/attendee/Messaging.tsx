import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DirectConversation } from '@/services/messaging.service';
import DirectConversationList from '@/components/attendee/DirectConversationList';
import DirectChatView from '@/components/attendee/DirectChatView';

export default function Messaging() {
  const { t } = useTranslation('messaging');
  const [selectedDirect, setSelectedDirect] = useState<DirectConversation | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-128px)]">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
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
      </div>
    </div>
  );
}
