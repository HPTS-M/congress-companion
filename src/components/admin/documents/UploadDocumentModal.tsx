import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
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

const ACCEPTED = '.pdf,.pptx,.docx,.xlsx';
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function getFileType(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'pptx' || ext === 'ppt') return 'pptx';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return ext ?? null;
}

export function UploadDocumentModal({ open, onClose, eventId, activities, onUploaded }: Props) {
  const { t } = useTranslation('admin');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setTitle('');
    setSessionId('');
    setDescription('');
    setUploading(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_SIZE) {
      toast.error(t('documents.fileTooLarge'));
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }, [title, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = useCallback(async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const { path, size } = await adminDocumentsService.uploadFile(eventId, file);
      await adminDocumentsService.createDocument({
        event_id: eventId,
        title: title.trim(),
        file_path: path,
        file_type: getFileType(file.name),
        file_size: size,
        session_id: sessionId || null,
        description: description.trim() || null,
      });
      toast.success(t('documents.uploadSuccess'));
      onUploaded();
      handleClose();
    } catch {
      toast.error(t('documents.uploadError'));
    } finally {
      setUploading(false);
    }
  }, [file, title, sessionId, description, eventId, t, onUploaded, handleClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('documents.uploadTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          {!file ? (
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">{t('documents.dropHere')}</p>
              <p className="text-xs text-muted-foreground mb-2">{t('documents.maxSize')}</p>
              <label>
                <input type="file" accept={ACCEPTED} className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <span className="cursor-pointer text-sm font-medium text-primary underline">{t('documents.selectFile')}</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/50">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>{t('documents.changeFile')}</Button>
            </div>
          )}

          {/* Title */}
          <div>
            <Label>{t('documents.docTitle')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('documents.docTitlePlaceholder')} />
          </div>

          {/* Session */}
          <div>
            <Label>{t('documents.associateSession')}</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder={t('documents.noSession')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('documents.noSession')}</SelectItem>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label>{t('documents.description')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('documents.descriptionPlaceholder')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t('documents.cancel')}</Button>
          <Button onClick={handleUpload} disabled={!file || !title.trim() || uploading} className="bg-primary text-primary-foreground">
            {uploading ? t('documents.uploading') : t('documents.upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
