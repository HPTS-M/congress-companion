import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText } from 'lucide-react';
import { adminDocumentsService } from '@/services/admin-documents.service';
import type { EventActivity } from '@/types';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  activities: Pick<EventActivity, 'id' | 'title' | 'scheduled_date'>[];
  onUploaded: () => void;
}

interface QueueItem {
  id: string;
  file: File;
  title: string;
  sessionId: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const ACCEPTED_EXTS = ['pdf', 'ppt', 'pptx'] as const;
const ACCEPT_ATTR = ACCEPTED_EXTS.map((e) => `.${e}`).join(',');
const MAX_SIZE = 50 * 1024 * 1024;

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ppt' || ext === 'pptx') return 'pptx';
  return ext;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function BulkUploadDocumentsModal({ open, onClose, eventId, activities, onUploaded }: Props) {
  const { t } = useTranslation('admin');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setItems([]);
    setUploading(false);
    setProgress({ current: 0, total: 0 });
    setDragOver(false);
  }, []);

  const handleClose = useCallback(() => {
    if (uploading) return;
    reset();
    onClose();
  }, [uploading, reset, onClose]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted: QueueItem[] = [];
    const rejected: string[] = [];
    Array.from(files).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ACCEPTED_EXTS.includes(ext as typeof ACCEPTED_EXTS[number])) {
        rejected.push(`${f.name}: ${t('documents.bulkUpload.invalidType')}`);
        return;
      }
      if (f.size > MAX_SIZE) {
        rejected.push(`${f.name}: ${t('documents.bulkUpload.tooLarge')}`);
        return;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file: f,
        title: stripExt(f.name),
        sessionId: 'none',
        status: 'pending',
      });
    });
    if (rejected.length) toast.error(rejected.join('\n'));
    if (accepted.length) setItems((prev) => [...prev, ...accepted]);
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const uploadAll = useCallback(async () => {
    if (items.length === 0) return;
    setUploading(true);
    setProgress({ current: 0, total: items.length });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status === 'success') {
        success++;
        setProgress({ current: i + 1, total: items.length });
        continue;
      }
      updateItem(it.id, { status: 'uploading', error: undefined });
      try {
        const { path, size } = await adminDocumentsService.uploadFile(eventId, it.file);
        await adminDocumentsService.createDocument({
          event_id: eventId,
          title: it.title.trim() || stripExt(it.file.name),
          file_path: path,
          file_type: getFileType(it.file.name),
          file_size: size,
          session_id: it.sessionId && it.sessionId !== 'none' ? it.sessionId : null,
          description: null,
        });
        updateItem(it.id, { status: 'success' });
        success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error';
        updateItem(it.id, { status: 'error', error: msg });
        failed++;
      }
      setProgress({ current: i + 1, total: items.length });
    }

    setUploading(false);
    if (success > 0) {
      toast.success(t('documents.bulkUpload.success', { count: success }));
      onUploaded();
    }
    if (failed > 0) {
      toast.error(t('documents.bulkUpload.errors', { count: failed }));
    } else if (success > 0) {
      // All ok — close
      reset();
      onClose();
    }
  }, [items, eventId, onUploaded, onClose, reset, t]);

  const pendingCount = items.filter((i) => i.status !== 'success').length;
  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t('documents.bulkUpload.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <label
            htmlFor="bulk-files"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
            }`}
          >
            <Upload className="mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-foreground font-medium">{t('documents.bulkUpload.dropHint')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('documents.bulkUpload.acceptedFormats')}</p>
            <input
              id="bulk-files"
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          {/* File list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t('documents.bulkUpload.fileCount', { count: items.length })}
              </p>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className={`rounded-lg border p-3 space-y-2 ${
                      it.status === 'error'
                        ? 'border-destructive/40 bg-destructive/5'
                        : it.status === 'success'
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{it.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(it.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {!uploading && it.status !== 'success' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeItem(it.id)}
                          aria-label={t('documents.bulkUpload.removeFile')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{t('documents.docTitle')}</Label>
                        <Input
                          value={it.title}
                          onChange={(e) => updateItem(it.id, { title: e.target.value })}
                          disabled={uploading}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('documents.associateSession')}</Label>
                        <Select
                          value={it.sessionId}
                          onValueChange={(v) => updateItem(it.id, { sessionId: v })}
                          disabled={uploading}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('documents.noSession')}</SelectItem>
                            {activities.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {it.status === 'uploading' && (
                      <p className="text-xs text-primary">{t('documents.bulkUpload.uploading')}</p>
                    )}
                    {it.status === 'success' && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        ✓ {t('documents.bulkUpload.fileSuccess')}
                      </p>
                    )}
                    {it.status === 'error' && (
                      <p className="text-xs text-destructive">✗ {it.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('documents.bulkUpload.uploading')}</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={uploading} className="w-full sm:w-auto">
            {t('documents.cancel')}
          </Button>
          <Button
            onClick={uploadAll}
            disabled={uploading || pendingCount === 0}
            className="w-full sm:w-auto bg-primary text-primary-foreground"
          >
            {uploading
              ? t('documents.bulkUpload.uploading')
              : t('documents.bulkUpload.uploadAll', { count: pendingCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
