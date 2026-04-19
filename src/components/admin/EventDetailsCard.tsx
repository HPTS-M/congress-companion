import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useEvent } from '@/hooks/useEvent';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const buildSchema = (t: (k: string) => string) =>
  z
    .object({
      name: z.string().trim().min(2, t('settings.details.errors.nameRequired')),
      description: z.string().trim().max(2000).optional().or(z.literal('')),
      start_date: z.date({ required_error: t('settings.details.errors.startRequired') }),
      end_date: z.date({ required_error: t('settings.details.errors.endRequired') }),
      venue_name: z.string().trim().max(200).optional().or(z.literal('')),
      venue_address: z.string().trim().max(500).optional().or(z.literal('')),
      max_attendees: z
        .number({ invalid_type_error: t('settings.details.errors.capacityInvalid') })
        .int()
        .positive(t('settings.details.errors.capacityPositive'))
        .max(100000)
        .optional()
        .nullable(),
    })
    .refine((d) => d.end_date >= d.start_date, {
      path: ['end_date'],
      message: t('settings.details.errors.endBeforeStart'),
    });

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

const toDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : undefined);
const toIso = (d: Date) => format(d, 'yyyy-MM-dd');

export function EventDetailsCard() {
  const { t } = useTranslation('admin');
  const { event, eventSlug } = useEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const schema = buildSchema(t);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      start_date: undefined as unknown as Date,
      end_date: undefined as unknown as Date,
      venue_name: '',
      venue_address: '',
      max_attendees: null,
    },
  });

  // Hydrate when event loads
  useEffect(() => {
    if (!event) return;
    form.reset({
      name: event.name ?? '',
      description: event.description ?? '',
      start_date: toDate(event.start_date) as Date,
      end_date: toDate(event.end_date) as Date,
      venue_name: event.venue_name ?? '',
      venue_address: event.venue_address ?? '',
      max_attendees: event.max_attendees ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!event) throw new Error('No event');
      const { error } = await supabase
        .from('events')
        .update({
          name: values.name.trim(),
          description: values.description?.trim() || null,
          start_date: toIso(values.start_date),
          end_date: toIso(values.end_date),
          venue_name: values.venue_name?.trim() || null,
          venue_address: values.venue_address?.trim() || null,
          max_attendees: values.max_attendees ?? null,
        })
        .eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventSlug] });
      toast({ title: t('settings.details.savedTitle'), description: t('settings.details.savedDescription') });
      form.reset(form.getValues());
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : t('settings.details.errorDescription');
      toast({ title: t('settings.details.errorTitle'), description: message, variant: 'destructive' });
    },
  });

  const isLoading = !event;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="h-5 w-5" />
          {t('settings.details.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('settings.details.description')}</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.details.fields.name')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isLoading || mutation.isPending}
                      placeholder={t('settings.details.placeholders.name')}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.details.fields.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      disabled={isLoading || mutation.isPending}
                      placeholder={t('settings.details.placeholders.description')}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('settings.details.fields.startDate')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isLoading || mutation.isPending}
                            className={cn(
                              'h-11 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : t('settings.details.placeholders.pickDate')}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('settings.details.fields.endDate')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isLoading || mutation.isPending}
                            className={cn(
                              'h-11 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : t('settings.details.placeholders.pickDate')}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => {
                            const start = form.getValues('start_date');
                            return start ? date < start : false;
                          }}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="venue_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.details.fields.venueName')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isLoading || mutation.isPending}
                      placeholder={t('settings.details.placeholders.venueName')}
                      className="h-11"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.details.fields.venueAddress')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isLoading || mutation.isPending}
                      placeholder={t('settings.details.placeholders.venueAddress')}
                      className="h-11"
                    />
                  </FormControl>
                  <FormDescription>{t('settings.details.hints.venueAddress')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_attendees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.details.fields.capacity')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      disabled={isLoading || mutation.isPending}
                      placeholder={t('settings.details.placeholders.capacity')}
                      className="h-11"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? null : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormDescription>{t('settings.details.hints.capacity')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={!form.formState.isDirty || mutation.isPending || isLoading}
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('settings.details.save')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
