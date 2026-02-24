import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { DocumentWithSession } from '@/services/admin-documents.service';

interface Props {
  documents: DocumentWithSession[];
  onFilterByIds?: (ids: string[], label: string) => void;
}

interface Alert {
  level: 'error' | 'warning';
  label: string;
  count: number;
  ids: string[];
}

export function DocumentQualityPanel({ documents, onFilterByIds }: Props) {
  const { t } = useTranslation('admin');
  const [expanded, setExpanded] = useState(false);

  const alerts = useMemo(() => {
    const result: Alert[] = [];

    // Duplicate titles
    const titleMap = new Map<string, string[]>();
    for (const d of documents) {
      const key = d.title.toLowerCase().trim();
      const arr = titleMap.get(key) ?? [];
      arr.push(d.id);
      titleMap.set(key, arr);
    }
    const dupTitleIds = [...titleMap.values()].filter((a) => a.length > 1).flat();
    if (dupTitleIds.length > 0) {
      result.push({ level: 'error', label: t('documents.quality.duplicates'), count: dupTitleIds.length, ids: dupTitleIds });
    }

    // Duplicate file_path (same filename)
    const pathMap = new Map<string, string[]>();
    for (const d of documents) {
      const filename = d.file_path.split('/').pop()?.toLowerCase() ?? '';
      const arr = pathMap.get(filename) ?? [];
      arr.push(d.id);
      pathMap.set(filename, arr);
    }
    const dupFileIds = [...pathMap.values()].filter((a) => a.length > 1).flat();
    // Merge with title dups - only show unique ones
    const dupFileOnly = dupFileIds.filter((id) => !dupTitleIds.includes(id));
    if (dupFileOnly.length > 0) {
      result.push({ level: 'error', label: t('documents.quality.duplicateFiles'), count: dupFileOnly.length, ids: dupFileOnly });
    }

    // No session
    const noSession = documents.filter((d) => !d.session_id);
    if (noSession.length > 0) {
      result.push({ level: 'warning', label: t('documents.quality.noSession'), count: noSession.length, ids: noSession.map((d) => d.id) });
    }

    // No file_path (broken)
    const noFile = documents.filter((d) => !d.file_path);
    if (noFile.length > 0) {
      result.push({ level: 'warning', label: t('documents.quality.noFile'), count: noFile.length, ids: noFile.map((d) => d.id) });
    }

    return result;
  }, [documents, t]);

  const hasIssues = alerts.length > 0;

  return (
    <Card>
      <CardContent className="p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-sm font-medium text-foreground"
        >
          <div className="flex items-center gap-2">
            {hasIssues ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <span>{t('documents.quality.title')}</span>
            {hasIssues && (
              <span className="text-xs text-muted-foreground">
                ({alerts.reduce((s, a) => s + a.count, 0)})
              </span>
            )}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {!hasIssues ? (
              <p className="text-sm text-green-600">{t('documents.quality.noIssues')}</p>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={a.level === 'error' ? 'text-red-500' : 'text-amber-500'}>
                      {a.level === 'error' ? '🔴' : '🟡'}
                    </span>
                    <span className="text-foreground">{a.label}</span>
                    <span className="text-xs text-muted-foreground">({a.count})</span>
                  </div>
                  {onFilterByIds && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onFilterByIds(a.ids, a.label)}>
                      {t('documents.quality.viewAffected')}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
