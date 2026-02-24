import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ES locale files
import esCommon from '@/locales/es/common.json';
import esAgenda from '@/locales/es/agenda.json';
import esCheckin from '@/locales/es/checkin.json';
import esTickets from '@/locales/es/tickets.json';
import esCommercial from '@/locales/es/commercial.json';
import esContacts from '@/locales/es/contacts.json';
import esAdmin from '@/locales/es/admin.json';
import esDocuments from '@/locales/es/documents.json';
import esNotes from '@/locales/es/notes.json';
import esMessaging from '@/locales/es/messaging.json';

// EN locale files
import enCommon from '@/locales/en/common.json';
import enAgenda from '@/locales/en/agenda.json';
import enCheckin from '@/locales/en/checkin.json';
import enTickets from '@/locales/en/tickets.json';
import enCommercial from '@/locales/en/commercial.json';
import enContacts from '@/locales/en/contacts.json';
import enAdmin from '@/locales/en/admin.json';
import enDocuments from '@/locales/en/documents.json';
import enNotes from '@/locales/en/notes.json';
import enMessaging from '@/locales/en/messaging.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: esCommon,
        agenda: esAgenda,
        checkin: esCheckin,
        tickets: esTickets,
        commercial: esCommercial,
        contacts: esContacts,
        admin: esAdmin,
        documents: esDocuments,
        notes: esNotes,
        messaging: esMessaging,
      },
      en: {
        common: enCommon,
        agenda: enAgenda,
        checkin: enCheckin,
        tickets: enTickets,
        commercial: enCommercial,
        contacts: enContacts,
        admin: enAdmin,
        documents: enDocuments,
        notes: enNotes,
        messaging: enMessaging,
      },
    },
    fallbackLng: 'es',
    defaultNS: 'common',
    ns: ['common', 'agenda', 'checkin', 'tickets', 'commercial', 'contacts', 'admin', 'documents', 'notes', 'messaging'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [],
    },
  });

export default i18n;
