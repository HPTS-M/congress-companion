import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Presentation, Sheet, Download } from 'lucide-react';
import { useEvent, useEventSettings } from '@/hooks/useEvent';
import { useDocuments } from '@/hooks/useDocuments';
import { documentsService, type EventDocument } from '@/services/documents.service';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

type FilterTab = 'all' | 'presentations' | 'abstracts' | 'guides';

const FILE_TYPE_CONFIG: Record<string, { icon: typeof FileText; bgClass: string }> = {
  pdf: { icon: FileText, bgClass: 'bg-red-500' },
  pptx: { icon: Presentation, bgClass: 'bg-orange-500' },
  docx: { icon: FileText, bgClass: 'bg-blue-500' },
  xlsx: { icon: Sheet, bgClass: 'bg-green-500' },
};

function getConfig(fileType: string | null) {
  return FILE_TYPE_CONFIG[fileType ?? ''] ?? FILE_TYPE_CONFIG.pdf;
}

function matchesFilter(doc: EventDocument, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'presentations') return doc.file_type === 'pptx';
  if (filter === 'abstracts') return doc.title.toLowerCase().includes('abstract');
  if (filter === 'guides') {
    const t = doc.title.toLowerCase();
    return t.includes('guía') || t.includes('guia');
  }
  return true;
}

export default function Documents() {
  const { t } = useTranslation('documents');
  const { event } = useEvent();
  const { documentsDownloadEnabled } = useEventSettings();
  const { data: documents, isLoading } = useDocuments(event?.id ?? '');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    { key: 'presentations', label: t('filters.presentations') },
    { key: 'abstracts', label: t('filters.abstracts') },
    { key: 'guides', label: t('filters.guides') },
  ];

  const filtered = (documents ?? []).filter((d) => matchesFilter(d, activeFilter));

  const handleDownload = async (doc: EventDocument) => {
    if (downloading) return;
    setDownloading(doc.id);
    try {
      const url = await documentsService.getSignedUrl(doc.file_path);
      // Synthetic <a download> avoids mobile pop-up blockers triggered by
      // window.open() called after an await.
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.${doc.file_type ?? 'pdf'}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast({
        title: 'Error',
        description: t('downloadError'),
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="px-4 pb-24 pt-4">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* Filter tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          filtered.map((doc) => {
            const config = getConfig(doc.file_type);
            const Icon = config.icon;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 dark:bg-slate-800"
              >
                {/* File type icon */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bgClass}`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {doc.title}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {doc.session_title ?? t('general')}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {doc.file_type ?? 'pdf'}
                  </p>
                </div>

                {/* Download */}
                {documentsDownloadEnabled && (
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloading === doc.id}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-muted disabled:opacity-50"
                    aria-label="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
