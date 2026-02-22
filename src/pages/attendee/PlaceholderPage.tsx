import { useTranslation } from 'react-i18next';

interface PlaceholderPageProps {
  titleKey: string;
}

export default function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <h1 className="text-xl font-bold text-foreground">{t(titleKey)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('comingSoon')}</p>
    </div>
  );
}
