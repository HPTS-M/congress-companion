import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { AdminAnnouncement } from '@/services/admin-communications.service';

export type AnnouncementSubmit = {
  title: string;
  body: string;
  scheduledFor: Date | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AnnouncementSubmit) => Promise<void>;
  isSubmitting: boolean;
  announcement?: AdminAnnouncement | null; // null/undefined = create mode
  duplicateError?: boolean;
  onClearDuplicate?: () => void;
}

function toLocalInputValue(d: Date | null) {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AnnouncementModal({
  open, onClose, onSubmit, isSubmitting, announcement, duplicateError, onClearDuplicate,
}: Props) {
  const { t } = useTranslation('admin');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const isEditing = !!announcement;
  const isAlreadyScheduled = !!(announcement?.scheduled_for && !announcement?.sent_at);

  useEffect(() => {
    if (!open) return;
    if (announcement) {
      setTitle(announcement.title);
      setBody(announcement.body);
      if (isAlreadyScheduled) {
        setMode('schedule');
        setScheduledAt(toLocalInputValue(new Date(announcement.scheduled_for!)));
      } else {
        setMode('now');
        setScheduledAt('');
      }
    } else {
      setTitle('');
      setBody('');
      setMode('now');
      setScheduledAt('');
    }
  }, [open, announcement, isAlreadyScheduled]);

  const minDateTime = (() => {
    const d = new Date(Date.now() + 60_000);
    return toLocalInputValue(d);
  })();

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !isSubmitting &&
    (mode === 'now' || (!!scheduledAt && new Date(scheduledAt).getTime() > Date.now()));

  const handleSubmit = async () => {
    const scheduledFor =
      mode === 'schedule' && scheduledAt ? new Date(scheduledAt) : null;
    await onSubmit({ title: title.trim(), body: body.trim(), scheduledFor });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('communications.editTitle') : t('communications.newAnnouncement')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('communications.editAnnouncementDesc')
              : t('communications.newAnnouncementDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('communications.fieldTitle')}</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                onClearDuplicate?.();
              }}
              placeholder={t('communications.fieldTitlePlaceholder')}
              className={duplicateError ? 'border-destructive' : ''}
              maxLength={200}
            />
            {duplicateError && (
              <p className="text-xs text-destructive">{t('communications.duplicateTitle')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('communications.fieldBody')}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('communications.fieldBodyPlaceholder')}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('communications.deliveryMode')}</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'now' | 'schedule')}>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="mode-now" value="now" />
                <Label htmlFor="mode-now" className="font-normal cursor-pointer">
                  {t('communications.sendNow')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="mode-schedule" value="schedule" />
                <Label htmlFor="mode-schedule" className="font-normal cursor-pointer">
                  {t('communications.scheduleFor')}
                </Label>
              </div>
            </RadioGroup>

            {mode === 'schedule' && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                min={minDateTime}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('communications.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting
              ? t('communications.sending')
              : isEditing
                ? t('communications.saveChanges')
                : mode === 'schedule'
                  ? t('communications.schedule')
                  : t('communications.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
