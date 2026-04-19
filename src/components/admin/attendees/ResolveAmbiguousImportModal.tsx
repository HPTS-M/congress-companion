import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export interface AmbiguousCandidate {
  id: string;
  full_name: string;
  credential_code: string;
  external_credential_code: string | null;
  created_at: string | null;
}

export interface AmbiguousRow {
  rowIndex: number;
  rowNumber: number;
  fullName: string;
  email: string;
  incomingCongressCode: string;
  candidates: AmbiguousCandidate[];
}

export type AmbiguousResolutionMap = Record<
  number,
  { action: 'create' } | { action: 'update'; targetAttendeeId: string } | { action: 'skip' }
>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ambiguousRows: AmbiguousRow[];
  onResolve: (resolutions: AmbiguousResolutionMap) => void;
}

export function ResolveAmbiguousImportModal({
  open, onOpenChange, ambiguousRows, onResolve,
}: Props) {
  const { t } = useTranslation('admin');
  const [resolutions, setResolutions] = useState<AmbiguousResolutionMap>({});

  useEffect(() => {
    if (open) setResolutions({});
  }, [open]);

  const setResolution = (
    rowIndex: number,
    value: string,
  ) => {
    setResolutions((prev) => {
      if (value === '__skip') return { ...prev, [rowIndex]: { action: 'skip' } };
      if (value === '__create') return { ...prev, [rowIndex]: { action: 'create' } };
      return { ...prev, [rowIndex]: { action: 'update', targetAttendeeId: value } };
    });
  };

  const allResolved = useMemo(
    () => ambiguousRows.every((r) => resolutions[r.rowIndex] !== undefined),
    [ambiguousRows, resolutions],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {t('attendees.importModal.resolve.title')}
          </DialogTitle>
          <DialogDescription>
            {t('attendees.importModal.resolve.description', { count: ambiguousRows.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {ambiguousRows.map((row) => {
            const currentValue = (() => {
              const r = resolutions[row.rowIndex];
              if (!r) return '';
              if (r.action === 'skip') return '__skip';
              if (r.action === 'create') return '__create';
              return r.targetAttendeeId;
            })();

            return (
              <div key={row.rowIndex} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="text-sm">
                  <span className="text-xs text-muted-foreground">
                    #{row.rowNumber} · {row.email}
                  </span>
                  <div className="font-medium text-foreground">{row.fullName}</div>
                  {row.incomingCongressCode && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('attendees.congressCode')}:{' '}
                      <span className="font-mono text-foreground">{row.incomingCongressCode}</span>
                    </div>
                  )}
                </div>

                <RadioGroup
                  value={currentValue}
                  onValueChange={(v) => setResolution(row.rowIndex, v)}
                  className="space-y-2"
                >
                  {row.candidates.map((c) => (
                    <Label
                      key={c.id}
                      htmlFor={`r-${row.rowIndex}-${c.id}`}
                      className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <RadioGroupItem value={c.id} id={`r-${row.rowIndex}-${c.id}`} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>
                            <span className="font-mono">{c.credential_code}</span>
                            {c.external_credential_code && (
                              <>
                                {' · '}
                                <span className="font-mono">{c.external_credential_code}</span>
                              </>
                            )}
                          </div>
                          {c.created_at && (
                            <div>
                              {format(new Date(c.created_at), 'dd/MM/yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                    </Label>
                  ))}

                  <Label
                    htmlFor={`r-${row.rowIndex}-create`}
                    className="flex items-center gap-3 rounded-md border border-dashed border-border p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <RadioGroupItem value="__create" id={`r-${row.rowIndex}-create`} />
                    <span className="text-sm text-foreground">
                      {t('attendees.importModal.resolve.createNew')}
                    </span>
                  </Label>

                  <Label
                    htmlFor={`r-${row.rowIndex}-skip`}
                    className="flex items-center gap-3 rounded-md border border-dashed border-border p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <RadioGroupItem value="__skip" id={`r-${row.rowIndex}-skip`} />
                    <span className="text-sm text-muted-foreground">
                      {t('attendees.importModal.resolve.skip')}
                    </span>
                  </Label>
                </RadioGroup>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('attendees.deleteConfirm.cancel')}
          </Button>
          <Button
            disabled={!allResolved}
            onClick={() => {
              onResolve(resolutions);
              onOpenChange(false);
            }}
          >
            {t('attendees.importModal.resolve.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
