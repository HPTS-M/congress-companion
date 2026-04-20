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

const PREVIEWABLE_IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

export function SponsorMaterialPreviewModal({ open, onClose, filePath, fileName }: Props) {
  const { t } = useTranslation('admin');
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!open || !filePath) {
      setUrl(null);
      setRenderError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRenderError(false);
    adminSponsorsService.getSignedUrl(filePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setUrl(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, filePath]);

  const ext = (filePath?.split('.').pop() ?? '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = PREVIEWABLE_IMAGE.includes(ext);
  const canPreview = (isPdf || isImage) && !renderError;

  const handleDownload = () => {
    if (!url) return;
    const a = window.document.createElement('a');
    a.href = url;
    a.download = fileName ?? `material.${ext || 'pdf'}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 text-base sm:text-lg">
            {fileName ?? t('sponsors.preview.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-[300px] sm:min-h-[400px] overflow-auto rounded-lg border border-border bg-muted/30">
          {loading ? (
            <Skeleton className="h-full w-full min-h-[300px] sm:min-h-[400px]" />
          ) : !url ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileX className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('sponsors.preview.error')}</p>
            </div>
          ) : !canPreview ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileX className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium mb-1">{t('sponsors.preview.notSupported')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('sponsors.preview.useDownload')}</p>
              <Button onClick={handleDownload} size="sm">
                <Download className="mr-1 h-4 w-4" />
                {t('sponsors.preview.download')}
              </Button>
            </div>
          ) : isPdf ? (
            <object
              data={url}
              type="application/pdf"
              className="w-full h-[60vh] sm:h-[70vh]"
              onError={() => setRenderError(true)}
            >
              <iframe
                src={url}
                className="w-full h-[60vh] sm:h-[70vh]"
                title={fileName ?? 'material'}
                onError={() => setRenderError(true)}
              />
            </object>
          ) : (
            <div className="flex items-center justify-center p-4">
              <img
                src={url}
                alt={fileName ?? 'material'}
                className="max-w-full max-h-[60vh] sm:max-h-[70vh] object-contain"
                onError={() => setRenderError(true)}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {t('sponsors.cancel')}
          </Button>
          {url && (
            <Button onClick={handleDownload} className="w-full sm:w-auto">
              <Download className="mr-1 h-4 w-4" />
              {t('sponsors.preview.download')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
