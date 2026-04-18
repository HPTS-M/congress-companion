import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileX } from 'lucide-react';
import { adminSponsorsService } from '@/services/admin-sponsors.service';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Storage path inside the event-sponsors bucket */
  filePath: string | null;
  fileName?: string;
}

export function SponsorMaterialPreviewModal({ open, onClose, filePath, fileName }: Props) {
  const { t } = useTranslation('admin');
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !filePath) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    adminSponsorsService.getSignedUrl(filePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setUrl(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, filePath]);

  const ext = (filePath?.split('.').pop() ?? '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

  const handleDownload = () => {
    if (!url) return;
    const a = window.document.createElement('a');
    a.href = url;
    a.download = fileName ?? `material.${ext || 'pdf'}`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {fileName ?? t('sponsors.preview.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-[400px] overflow-auto rounded-lg border border-border bg-muted/30">
          {loading ? (
            <Skeleton className="h-full w-full min-h-[400px]" />
          ) : !url ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileX className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('sponsors.preview.error')}</p>
            </div>
          ) : isPdf ? (
            <iframe src={url} className="w-full h-[70vh]" title="material" />
          ) : isImage ? (
            <div className="flex items-center justify-center p-4">
              <img src={url} alt="material" className="max-w-full max-h-[70vh] object-contain" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileX className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium mb-1">{t('sponsors.preview.notSupported')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('sponsors.preview.useDownload')}</p>
              <Button onClick={handleDownload} size="sm">
                <Download className="mr-1 h-4 w-4" />
                {t('sponsors.preview.download')}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>{t('sponsors.cancel')}</Button>
          {url && (
            <Button onClick={handleDownload}>
              <Download className="mr-1 h-4 w-4" />
              {t('sponsors.preview.download')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
