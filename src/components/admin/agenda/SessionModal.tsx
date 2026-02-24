import { useEffect } from 'react';
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
  description: z.string(),
  requires_checkin: z.boolean(),
  capacity: z.string(),
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
}

export function SessionModal({ open, onClose, onSave, session, isPending, rooms, defaultDate }: SessionModalProps) {
  const { t } = useTranslation('admin');
  const isEdit = !!session;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      activity_type: 'talk',
      scheduled_date: defaultDate ?? '',
      start_time: '',
      end_time: '',
      location: '',
      speaker_name: '',
      speaker_bio: '',
      description: '',
      requires_checkin: false,
      capacity: '',
    },
  });

  useEffect(() => {
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
        description: session.description ?? '',
        requires_checkin: session.requires_checkin ?? false,
        capacity: session.capacity?.toString() ?? '',
      });
    } else {
      form.reset({
        title: '',
        activity_type: 'talk',
        scheduled_date: defaultDate ?? '',
        start_time: '',
        end_time: '',
        location: '',
        speaker_name: '',
        speaker_bio: '',
        description: '',
        requires_checkin: false,
        capacity: '',
      });
    }
  }, [session, open, defaultDate, form]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('agenda.sessionModal.titleEdit') : t('agenda.sessionModal.titleNew')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="scheduled_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('agenda.sessionModal.day')}</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="start_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.startTime')}</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('agenda.sessionModal.endTime')}</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
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

            <div className="grid grid-cols-2 gap-4">
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

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('agenda.sessionModal.description')}</FormLabel>
                <FormControl><Textarea placeholder={t('agenda.sessionModal.descriptionPlaceholder')} rows={3} {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('attendees.deleteConfirm.cancel')}
              </Button>
              <Button type="submit" disabled={isPending} style={{ backgroundColor: '#1A56A0' }}>
                {isPending ? t('agenda.sessionModal.saving') : t('agenda.sessionModal.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
