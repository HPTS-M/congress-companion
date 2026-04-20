import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TimePicker } from './TimePicker';
import { SpeakerPhotoUpload } from './SpeakerPhotoUpload';
import type { EventActivity, ActivityType } from '@/types';

const ACTIVITY_TYPES: { value: ActivityType; labelKey: string }[] = [
  { value: 'talk', labelKey: 'typeTalk' },
  { value: 'workshop', labelKey: 'typeWorkshop' },
  { value: 'ceremony', labelKey: 'typeCeremony' },
  { value: 'other', labelKey: 'typeOther' },
  { value: 'symposium', labelKey: 'typeSymposium' },
  { value: 'conference_day', labelKey: 'typeConferenceDay' },
  { value: 'networking', labelKey: 'typeNetworking' },
];

const schema = z.object({
  title: z.string().min(1),
  activity_type: z.string().min(1),
  scheduled_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string(),
  location: z.string(),
  speaker_name: z.string(),
  speaker_bio: z.string(),
  speaker_photo_url: z.string().nullable().optional(),
  description: z.string(),
  requires_checkin: z.boolean(),
  capacity: z.string(),
  is_cancelled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormValues) => void;
  session?: EventActivity | null;
  isPending: boolean;
  rooms: string[];
  defaultDate?: string;
  eventId?: string;
}

const DRAFT_KEY = (eventId: string, sessionId: string) => `agenda-draft-${eventId}-${sessionId}`;

export function SessionModal({
  open, onClose, onSave, session, isPending, rooms, defaultDate, eventId,
}: SessionModalProps) {
  const { t } = useTranslation('admin');
  const isEdit = !!session;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const draftLoadedRef = useRef(false);

  const emptyValues: FormValues = {
    title: '',
    activity_type: 'talk',
    scheduled_date: defaultDate ?? '',
    start_time: '',
    end_time: '',
    location: '',
    speaker_name: '',
    speaker_bio: '',
    speaker_photo_url: null,
    description: '',
    requires_checkin: false,
    capacity: '',
    is_cancelled: false,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) {
      draftLoadedRef.current = false;
      return;
    }
    if (session) {
      form.reset({
        title: session.title,
        activity_type: session.activity_type ?? 'talk',
        scheduled_date: session.scheduled_date,
        start_time: session.start_time?.slice(0, 5) ?? '',
        end_time: session.end_time?.slice(0, 5) ?? '',
        location: session.location ?? '',
        speaker_name: session.speaker_name ?? '',
        speaker_bio: session.speaker_bio ?? '',
        speaker_photo_url: session.speaker_photo_url ?? null,
        description: session.description ?? '',
        requires_checkin: session.requires_checkin ?? false,
        capacity: session.capacity?.toString() ?? '',
        is_cancelled: session.status === 'cancelled',
      });
    } else {
      if (eventId && !draftLoadedRef.current) {
        try {
          const raw = localStorage.getItem(DRAFT_KEY(eventId, 'new'));
          if (raw) {
            const draft = JSON.parse(raw) as Partial<FormValues>;
            form.reset({ ...emptyValues, ...draft });
            draftLoadedRef.current = true;
            return;
          }
        } catch {
          /* ignore */
        }
      }
      form.reset(emptyValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, open, defaultDate]);

  useEffect(() => {
    if (!open || !eventId || isEdit) return;
    const interval = setInterval(() => {
      if (form.formState.isDirty) {
        try {
          localStorage.setItem(DRAFT_KEY(eventId, 'new'), JSON.stringify(form.getValues()));
        } catch {
          /* ignore */
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [open, eventId, isEdit, form]);

  const clearDraft = () => {
    if (!eventId) return;
    try {
      localStorage.removeItem(DRAFT_KEY(eventId, 'new'));
    } catch {
      /* ignore */
    }
  };

  const tryClose = () => {
    if (form.formState.isDirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setConfirmDiscard(false);
    if (!isEdit) clearDraft();
    onClose();
  };

  const handleSubmit = (data: FormValues) => {
    onSave(data);
    if (!isEdit) clearDraft();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) tryClose(); }}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t('agenda.sessionModal.titleEdit') : t('agenda.sessionModal.titleNew')}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.title')}</FormLabel>
                  <FormControl><Input placeholder={t('agenda.sessionModal.titlePlaceholder')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="activity_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.activityType')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((at) => (
                        <SelectItem key={at.value} value={at.value}>
                          {t(`agenda.sessionModal.${at.labelKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="scheduled_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.day')}</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="start_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.startTime')}</FormLabel>
                    <FormControl>
                      <TimePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.endTime')}</FormLabel>
                    <FormControl>
                      <TimePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.room')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('agenda.sessionModal.roomPlaceholder')} list="room-list" {...field} />
                  </FormControl>
                  <datalist id="room-list">
                    {rooms.map((r) => <option key={r} value={r} />)}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="speaker_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.speaker')}</FormLabel>
                    <FormControl><Input placeholder={t('agenda.sessionModal.speakerPlaceholder')} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="speaker_bio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.speakerBio')}</FormLabel>
                    <FormControl><Input placeholder={t('agenda.sessionModal.speakerBioPlaceholder')} {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="speaker_photo_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.speakerPhoto')}</FormLabel>
                  <FormControl>
                    <SpeakerPhotoUpload
                      eventId={eventId ?? ''}
                      value={field.value}
                      onChange={(p) => field.onChange(p)}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.description')}</FormLabel>
                  <FormControl><Textarea placeholder={t('agenda.sessionModal.descriptionPlaceholder')} rows={3} {...field} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="requires_checkin" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">{t('agenda.sessionModal.hasCertificate')}</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.maxCapacity')}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="is_cancelled" render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer text-destructive">
                    {t('agenda.sessionModal.markAsCancelled')}
                  </FormLabel>
                </FormItem>
              )} />

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={tryClose} className="w-full sm:w-auto">
                  {t('attendees.deleteConfirm.cancel')}
                </Button>
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                  {isPending ? t('agenda.sessionModal.saving') : t('agenda.sessionModal.save')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('agenda.sessionModal.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('agenda.sessionModal.discardDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('agenda.sessionModal.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground">
              {t('agenda.sessionModal.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
