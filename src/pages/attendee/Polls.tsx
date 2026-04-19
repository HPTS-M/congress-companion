import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Send, CheckCircle2, Star, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePolls, usePollRealtime } from '@/hooks/usePolls';
import { pollsService, type AttendeePoll, type PollResultOption } from '@/services/polls.service';
import { cn } from '@/lib/utils';

const POLL_TYPE_KEYS: Record<string, string> = {
  single_choice: 'polls.typeSingle',
  multiple_choice: 'polls.typeMultiple',
  rating_scale: 'polls.typeRating',
  open_text: 'polls.typeOpen',
};

const RATING_LABELS: Record<number, string> = {
  1: 'polls.ratingVeryBad',
  2: 'polls.ratingBad',
  3: 'polls.ratingRegular',
  4: 'polls.ratingGood',
  5: 'polls.ratingExcellent',
};

const MAX_TEXT_LENGTH = 500;

/* ───────────── Results View ───────────── */

function ChoiceResults({ pollId, myOptionId }: { pollId: string; myOptionId: string | null }) {
  const { t } = useTranslation('common');
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

  return (
    <div className="space-y-3 mt-3">
      {results.map(opt => {
        const isMyChoice = opt.id === myOptionId;
        return (
          <div key={opt.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className={cn('flex items-center gap-1.5', isMyChoice && 'font-semibold text-primary')}>
                {isMyChoice && <CheckCircle2 className="h-3.5 w-3.5" />}
                {opt.option_text}
              </span>
              <span className="font-medium text-muted-foreground">{opt.count} ({opt.percentage}%)</span>
            </div>
            <div className="h-5 w-full rounded bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded transition-all duration-500',
                  isMyChoice ? 'bg-primary' : 'bg-primary/50'
                )}
                style={{ width: `${opt.percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RatingResults({ pollId }: { pollId: string }) {
  const { t } = useTranslation('common');
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

  const totalResponses = results.reduce((s, r) => s + r.count, 0);
  const weightedSum = results.reduce((s, r) => {
    const val = parseInt(r.option_text, 10);
    return s + (isNaN(val) ? 0 : val * r.count);
  }, 0);
  const avg = totalResponses > 0 ? (weightedSum / totalResponses).toFixed(1) : '0.0';

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-center gap-2 text-2xl font-bold">
        <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
        <span>{avg}</span>
        <span className="text-base font-normal text-muted-foreground">/ 5</span>
      </div>
      <div className="space-y-1.5">
        {results.map(opt => (
          <div key={opt.id} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right font-medium">{opt.option_text}</span>
            <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
              <div className="h-full rounded bg-amber-400 transition-all duration-500" style={{ width: `${opt.percentage}%` }} />
            </div>
            <span className="w-12 text-right text-muted-foreground text-xs">{opt.count} ({opt.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Answer Forms ───────────── */

function ChoiceForm({ poll, onSubmit, isSubmitting }: {
  poll: AttendeePoll;
  onSubmit: (optionIds: string[]) => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation('common');
  const isMulti = poll.poll_type === 'multiple_choice';
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isMulti) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {isMulti && (
        <p className="text-xs text-muted-foreground">{t('polls.multiSelectHint')}</p>
      )}
      {poll.options.map(opt => {
        const isSelected = selected.has(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={cn(
              'w-full min-h-11 rounded-lg border-2 p-3 text-left text-sm font-medium transition-all flex items-center gap-3',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/50 dark:border-slate-700'
            )}
          >
            {isMulti && (
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2',
                isSelected ? 'border-primary-foreground bg-primary-foreground/20' : 'border-current'
              )}>
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
            )}
            <span className="flex-1">{opt.option_text}</span>
          </button>
        );
      })}
      <Button
        onClick={() => onSubmit(Array.from(selected))}
        disabled={selected.size === 0 || isSubmitting}
        className="w-full"
      >
        <Send className="mr-2 h-4 w-4" />
        {t('polls.submitResponse')}
      </Button>
    </div>
  );
}

function RatingForm({ poll, onSubmit, isSubmitting }: {
  poll: AttendeePoll;
  onSubmit: (optionId: string) => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation('common');
  const [selected, setSelected] = useState<string>('');

  if (poll.options.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        {t('polls.malformed')}
      </div>
    );
  }

  const selectedNum = poll.options.find(o => o.id === selected);
  const labelKey = selectedNum ? RATING_LABELS[parseInt(selectedNum.option_text, 10)] : null;

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        {poll.options.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={cn(
              'flex h-14 w-14 flex-col items-center justify-center rounded-xl border-2 text-lg font-bold transition-all',
              selected === opt.id
                ? 'border-amber-400 bg-amber-400 text-white shadow-md scale-110'
                : 'border-border hover:border-amber-300 dark:border-slate-700'
            )}
          >
            {opt.option_text}
          </button>
        ))}
      </div>
      {labelKey && (
        <p className="text-center text-sm font-medium text-muted-foreground">{t(labelKey)}</p>
      )}
      <Button onClick={() => onSubmit(selected)} disabled={!selected || isSubmitting} className="w-full">
        <Send className="mr-2 h-4 w-4" />
        {t('polls.submitRating')}
      </Button>
    </div>
  );
}

function OpenTextForm({ onSubmit, isSubmitting }: {
  onSubmit: (text: string) => void;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation('common');
  const [text, setText] = useState('');

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
        placeholder={t('polls.openPlaceholder')}
        rows={4}
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{text.length}/{MAX_TEXT_LENGTH}</span>
        <Button onClick={() => onSubmit(text.trim())} disabled={!text.trim() || isSubmitting} size="sm">
          <Send className="mr-2 h-4 w-4" />
          {t('polls.submitResponse')}
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Poll Card ───────────── */

function PollCard({ poll, onSubmit, isSubmitting }: {
  poll: AttendeePoll;
  onSubmit: (pollId: string, optionIds: string[] | null, text: string | null) => Promise<void>;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation('common');
  const [showAnswer, setShowAnswer] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submittedOptionId, setSubmittedOptionId] = useState<string | null>(null);
  const hasResponded = !!poll.my_response || justSubmitted;

  const isChoice = poll.poll_type === 'multiple_choice' || poll.poll_type === 'single_choice';
  const isRating = poll.poll_type === 'rating_scale';
  const isOpen = poll.poll_type === 'open_text';

  const typeKey = POLL_TYPE_KEYS[poll.poll_type] || 'polls.typeSingle';

  const handleSubmit = async (optionIds: string[] | null, text: string | null) => {
    try {
      setSubmittedOptionId(optionIds && optionIds.length > 0 ? optionIds[0] : null);
      await onSubmit(poll.id, optionIds, text);
      setJustSubmitted(true);
      setShowAnswer(false);
    } catch {
      // error handled by mutation
    }
  };

  const myOptionId = poll.my_response?.option_id ?? submittedOptionId;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="space-y-1.5">
          <p className="text-base font-semibold leading-snug">{poll.question}</p>
          <div className="flex flex-wrap items-center gap-2">
            {poll.session && (
              <Badge className="bg-accent/10 text-accent border-accent/20 text-xs">{poll.session.title}</Badge>
            )}
            <span className="text-xs text-muted-foreground">{t(typeKey)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {poll.response_count} {t('polls.responseCount')}
          </p>
        </div>

        {/* Already answered → Results */}
        {hasResponded && !showAnswer ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">{t('polls.answered')}</span>
            </div>

            {isChoice && <ChoiceResults pollId={poll.id} myOptionId={myOptionId} />}
            {isRating && <RatingResults pollId={poll.id} />}
            {isOpen && (poll.my_response?.text_response) && (
              <div className="mt-2 rounded-lg bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('polls.yourResponse')}</p>
                <p className="text-sm">{poll.my_response.text_response}</p>
              </div>
            )}
          </div>
        ) : showAnswer ? (
          /* Answer Form */
          <div>
            {isChoice && (
              <ChoiceForm
                poll={poll}
                onSubmit={optIds => handleSubmit(optIds, null)}
                isSubmitting={isSubmitting}
              />
            )}
            {isRating && (
              <RatingForm
                poll={poll}
                onSubmit={optId => handleSubmit([optId], null)}
                isSubmitting={isSubmitting}
              />
            )}
            {isOpen && (
              <OpenTextForm
                onSubmit={text => handleSubmit(null, text)}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        ) : (
          /* CTA buttons */
          <Button onClick={() => setShowAnswer(true)} className="w-full">
            <MessageSquareText className="mr-2 h-4 w-4" />
            {t('polls.answerCta')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────── Main Page ───────────── */

export default function AttendeePolls() {
  const { t } = useTranslation('common');
  const { polls, isLoading, submitResponse } = usePolls();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('polls.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('polls.subtitle')}</p>
      </div>

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
            onSubmit={(pollId, optionIds, text) =>
              submitResponse.mutateAsync({ pollId, optionIds, textResponse: text })
            }
            isSubmitting={submitResponse.isPending}
          />
        ))
      )}
    </div>
  );
}
