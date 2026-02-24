import { useState, useCallback, useEffect } from 'react';
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
import { FileText, Upload } from 'lucide-react';
import { adminDocumentsService } from '@/services/admin-documents.service';
import type { DocumentWithSession } from '@/services/admin-documents.service';
import type { EventActivity } from '@/types';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  document: DocumentWithSession | null;
  eventId: string;
  activities: Pick<EventActivity, 'id' | 'title' | 'scheduled_date'>[];
  onUpdated: () => void;
}

const ACCEPTED = '.pdf,.pptx,.docx,.xlsx';

export function EditDocumentModal({ open, onClose, document: doc, eventId, activities, onUpdated }: Props) {
  const { t } = useTranslation('admin');
  const [title, setTitle] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [description, setDescription] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setSessionId(doc.session_id ?? 'none');
      setDescription(doc.description ?? '');
      setNewFile(null);
    }
  }, [doc]);

  const handleClose = useCallback(() => { setNewFile(null); onClose(); }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!doc || !title.trim()) return;
    setSaving(true);
    try {
      let filePath = doc.file_path;
      let fileSize = doc.file_size;
      let fileType = doc.file_type;

      if (newFile) {
        const result = await adminDocumentsService.replaceFile(eventId, doc.file_path, newFile);
        filePath = result.path;
        fileSize = result.size;
        const ext = newFile.name.split('.').pop()?.toLowerCase();
        fileType = ext ?? doc.file_type;
      }

      // Build update payload
      const updates: Record<string, unknown> = {
        title: title.trim(),
        session_id: sessionId === 'none' ? null : sessionId || null,
        description: description.trim() || null,
      };
      if (newFile) {
        updates.file_path = filePath;
        updates.file_size = fileSize;
        updates.file_type = fileType;
      }

      await adminDocumentsService.updateDocument(doc.id, updates);
      toast.success(t('documents.editSuccess'));
      onUpdated();
      handleClose();
    } catch {
      toast.error(t('documents.editError'));
    } finally {
      setSaving(false);
    }
  }, [doc, title, sessionId, description, newFile, eventId, t, onUpdated, handleClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('documents.editTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label>{t('documents.docTitle')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
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
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Replace file */}
          <div>
            <Label>{t('documents.replaceFile')}</Label>
            {newFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-2 bg-muted/50 mt-1">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm truncate flex-1">{newFile.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setNewFile(null)}>✕</Button>
              </div>
            ) : (
              <label className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-primary underline">
                <Upload className="h-4 w-4" />
                {t('documents.selectNewFile')}
                <input type="file" accept={ACCEPTED} className="hidden" onChange={(e) => e.target.files?.[0] && setNewFile(e.target.files[0])} />
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t('documents.cancel')}</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving} className="bg-primary text-primary-foreground">
            {saving ? t('documents.saving') : t('documents.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
