import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Plus, Play, Square, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminPolls, useAdminPollResults } from '@/hooks/useAdminPolls';
import { usePollRealtime } from '@/hooks/usePolls';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ---- New Poll Modal ----
function NewPollModal({
  open,
  onOpenChange,
  sessions,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: { id: string; title: string }[];
  onSave: (data: { question: string; pollType: string; sessionId: string | null; opensAt: string | null; closesAt: string | null; options: string[] }) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation('admin');
  const [question, setQuestion] = useState('');
  const [pollType, setPollType] = useState('multiple_choice');
  const [sessionId, setSessionId] = useState('');
  const [options, setOptions] = useState(['', '']);

  const needsOptions = pollType === 'multiple_choice' || pollType === 'single_choice';
  const validOptions = options.filter(o => o.trim());
  const canSave = question.trim() && (!needsOptions || validOptions.length >= 2);

  const handleSave = () => {
    onSave({
      question: question.trim(),
      pollType,
      sessionId: sessionId || null,
      opensAt: null,
      closesAt: null,
      options: needsOptions ? validOptions : [],
    });
    // Reset
    setQuestion('');
    setPollType('multiple_choice');
    setSessionId('');
    setOptions(['', '']);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('polls.newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('polls.fieldQuestion')}</label>
            <Textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder={t('polls.questionPlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('polls.fieldType')}</label>
            <Select value={pollType} onValueChange={setPollType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">{t('polls.typeMultiple')}</SelectItem>
                <SelectItem value="single_choice">{t('polls.typeSingle')}</SelectItem>
                <SelectItem value="rating_scale">{t('polls.typeRating')}</SelectItem>
                <SelectItem value="open_text">{t('polls.typeOpen')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{t('polls.fieldSession')}</label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder={t('polls.noSession')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('polls.noSession')}</SelectItem>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOptions && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('polls.fieldOptions')}</label>
              {options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={e => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`${t('polls.optionLabel')} ${idx + 1}`}
                  />
                  {options.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setOptions([...options, ''])}>
                <Plus className="mr-1 h-3 w-3" />{t('polls.addOption')}
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('polls.cancel')}</Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? t('polls.saving') : t('polls.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Results Modal ----
function ResultsModal({
  pollId,
  open,
  onOpenChange,
}: {
  pollId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation('admin');
  const { data: results, isLoading, refetch } = useAdminPollResults(pollId);
  const qc = useQueryClient();

  const handleRealtime = useCallback(() => {
    refetch();
  }, [refetch]);

  usePollRealtime(open ? pollId : null, handleRealtime);

  if (!pollId) return null;

  const isChoiceType = results?.poll_type === 'multiple_choice' || results?.poll_type === 'single_choice';
  const isRating = results?.poll_type === 'rating_scale';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('polls.resultsTitle')}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : results ? (
          <div className="space-y-4">
            <p className="text-lg font-semibold">{results.question}</p>
            <p className="text-sm text-muted-foreground">
              {t('polls.totalResponses')}: <span className="font-bold text-foreground">{results.total_responses}</span>
            </p>

            {isChoiceType && results.options?.map(opt => (
              <div key={opt.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{opt.option_text}</span>
                  <span className="font-medium">{opt.count} ({opt.percentage}%)</span>
                </div>
                <div className="h-6 w-full rounded bg-muted overflow-hidden">
                  <div
                    className="h-full rounded bg-[hsl(var(--primary))] transition-all duration-500"
                    style={{ width: `${opt.percentage}%` }}
                  />
                </div>
              </div>
            ))}

            {isRating && results.options?.length > 0 && (
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(star => {
                  const opt = results.options.find(o => o.option_text === String(star));
                  const count = opt?.count || 0;
                  const pct = opt?.percentage || 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-8">{'⭐'.repeat(star)}</span>
                      <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                        <div className="h-full rounded bg-[hsl(var(--primary))]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {results.poll_type === 'open_text' && (
              <p className="text-sm text-muted-foreground italic">{t('polls.openTextNote')}</p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---- Status Badge ----
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin');
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs',
        status === 'draft' && 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
        status === 'active' && 'border-teal-300 text-teal-700 bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:bg-teal-900/30',
        status === 'closed' && 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/30'
      )}
    >
      {status === 'active' && <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-teal-500" />}
      {t(`polls.status_${status}`)}
    </Badge>
  );
}

const pollTypeLabels: Record<string, string> = {
  multiple_choice: 'typeMultiple',
  single_choice: 'typeSingle',
  rating_scale: 'typeRating',
  open_text: 'typeOpen',
};

// ---- Main Page ----
export default function AdminPolls() {
  const { t } = useTranslation('admin');
  const { polls, isLoading, sessions, createPoll, updateStatus, deletePoll } = useAdminPolls();
  const [showNew, setShowNew] = useState(false);
  const [resultsId, setResultsId] = useState<string | null>(null);

  const stats = {
    total: polls.length,
    active: polls.filter(p => p.status === 'active').length,
    closed: polls.filter(p => p.status === 'closed').length,
    responses: polls.reduce((sum, p) => sum + (p.response_count || 0), 0),
  };

  const handleCreate = (data: any) => {
    createPoll.mutate(data, { onSuccess: () => setShowNew(false) });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('polls.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('polls.subtitle')}</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-[hsl(var(--primary))]">
          <Plus className="mr-2 h-4 w-4" />{t('polls.newPoll')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('polls.statTotal'), value: stats.total },
          { label: t('polls.statActive'), value: stats.active },
          { label: t('polls.statClosed'), value: stats.closed },
          { label: t('polls.statResponses'), value: stats.responses },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {polls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-muted-foreground">{t('polls.noPolls')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('polls.colQuestion')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('polls.colSession')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('polls.colType')}</TableHead>
                  <TableHead>{t('polls.colStatus')}</TableHead>
                  <TableHead className="text-center">{t('polls.colResponses')}</TableHead>
                  <TableHead className="text-right">{t('polls.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polls.map(poll => (
                  <TableRow key={poll.id}>
                    <TableCell className="max-w-[250px]">
                      <span className="line-clamp-2 font-medium">{poll.question}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {poll.session?.title ?? '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {t(`polls.${pollTypeLabels[poll.poll_type] || 'typeMultiple'}`)}
                    </TableCell>
                    <TableCell><StatusBadge status={poll.status} /></TableCell>
                    <TableCell className="text-center font-medium">{poll.response_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {poll.status === 'draft' && (
                          <Button variant="ghost" size="icon" title={t('polls.activate')}
                            onClick={() => updateStatus.mutate({ pollId: poll.id, status: 'active' })}>
                            <Play className="h-4 w-4 text-teal-600" />
                          </Button>
                        )}
                        {poll.status === 'active' && (
                          <Button variant="ghost" size="icon" title={t('polls.close')}
                            onClick={() => updateStatus.mutate({ pollId: poll.id, status: 'closed' })}>
                            <Square className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title={t('polls.viewResults')}
                          onClick={() => setResultsId(poll.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t('polls.delete')}
                          onClick={() => deletePoll.mutate(poll.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewPollModal
        open={showNew}
        onOpenChange={setShowNew}
        sessions={sessions}
        onSave={handleCreate}
        isSaving={createPoll.isPending}
      />

      <ResultsModal
        pollId={resultsId}
        open={!!resultsId}
        onOpenChange={v => { if (!v) setResultsId(null); }}
      />
    </div>
  );
}
