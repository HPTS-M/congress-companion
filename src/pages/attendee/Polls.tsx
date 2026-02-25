import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePolls, usePollRealtime } from '@/hooks/usePolls';
import { pollsService, type PollResultOption } from '@/services/polls.service';
import { cn } from '@/lib/utils';

function PollResults({ pollId }: { pollId: string }) {
  const [results, setResults] = useState<PollResultOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadResults = useCallback(async () => {
    const data = await pollsService.getPollResults(pollId);
    setResults(data);
    setLoaded(true);
  }, [pollId]);

  useEffect(() => { loadResults(); }, [loadResults]);

  usePollRealtime(pollId, loadResults);

  if (!loaded) return <Skeleton className="h-24" />;

  const maxCount = Math.max(...results.map(r => r.count), 1);

  return (
    <div className="space-y-2 mt-3">
      {results.map(opt => (
        <div key={opt.id} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{opt.option_text}</span>
            <span className="font-medium text-muted-foreground">{opt.count} ({opt.percentage}%)</span>
          </div>
          <div className="h-5 w-full rounded bg-muted overflow-hidden">
            <div
              className="h-full rounded bg-[hsl(var(--primary))] transition-all duration-500"
              style={{ width: `${opt.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PollCard({ poll, onSubmit, isSubmitting }: {
  poll: any;
  onSubmit: (pollId: string, optionId: string | null, text: string | null) => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation('common');
  const [selected, setSelected] = useState<string>('');
  const [textInput, setTextInput] = useState('');
  const hasResponded = !!poll.my_response;

  const isChoice = poll.poll_type === 'multiple_choice' || poll.poll_type === 'single_choice';
  const isRating = poll.poll_type === 'rating_scale';
  const isOpen = poll.poll_type === 'open_text';

  const handleSubmit = () => {
    if (isChoice) {
      onSubmit(poll.id, selected, null);
    } else if (isRating) {
      onSubmit(poll.id, selected, null);
    } else {
      onSubmit(poll.id, null, textInput.trim());
    }
  };

  const canSubmit = isChoice ? !!selected : isRating ? !!selected : textInput.trim().length > 0;

  // Rating options
  const ratingOptions = isRating
    ? poll.options.length > 0
      ? poll.options
      : [1, 2, 3, 4, 5].map((n, i) => ({ id: `rating-${n}`, option_text: String(n), order_index: i }))
    : [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-base font-semibold leading-snug">{poll.question}</p>
          {poll.session && (
            <Badge variant="outline" className="text-xs">{poll.session.title}</Badge>
          )}
          <p className="text-xs text-muted-foreground">
            {poll.response_count} {t('polls.respondedCount')}
          </p>
        </div>

        {hasResponded ? (
          <div>
            <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('polls.alreadyAnswered')}</span>
            </div>
            {isChoice && <PollResults pollId={poll.id} />}
          </div>
        ) : (
          <>
            {isChoice && (
              <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2">
                {poll.options.map((opt: any) => (
                  <div key={opt.id} className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelected(opt.id)}>
                    <RadioGroupItem value={opt.id} id={opt.id} />
                    <Label htmlFor={opt.id} className="flex-1 cursor-pointer">{opt.option_text}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {isRating && (
              <div className="flex justify-center gap-2">
                {ratingOptions.map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelected(opt.id)}
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg border-2 text-lg font-bold transition-all',
                      selected === opt.id
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                        : 'border-border hover:border-[hsl(var(--primary))]'
                    )}
                  >
                    {opt.option_text}
                  </button>
                ))}
              </div>
            )}

            {isOpen && (
              <Textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={t('polls.typePlaceholder')}
                rows={3}
              />
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="w-full bg-[hsl(var(--primary))]"
            >
              <Send className="mr-2 h-4 w-4" />
              {t('polls.submit')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AttendeePolls() {
  const { t } = useTranslation('common');
  const { polls, isLoading, submitResponse } = usePolls();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t('polls.title')}</h1>

      {polls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">{t('polls.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-[280px]">{t('polls.emptyDescription')}</p>
        </div>
      ) : (
        polls.map(poll => (
          <PollCard
            key={poll.id}
            poll={poll}
            onSubmit={(pollId, optionId, text) =>
              submitResponse.mutate({ pollId, optionId, textResponse: text })
            }
            isSubmitting={submitResponse.isPending}
          />
        ))
      )}
    </div>
  );
}
