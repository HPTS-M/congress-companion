import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, FileText } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useBulkCreateAttendees } from '@/hooks/useAdminAttendees';

interface CsvRow {
  full_name: string;
  email: string;
  specialty?: string;
  institution?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return {
      full_name: row.full_name || row.nombre || '',
      email: row.email || row.correo || '',
      specialty: row.specialty || row.especialidad || undefined,
      institution: row.institution || row.institucion || undefined,
    };
  }).filter((r) => r.full_name && r.email);
}

function downloadTemplate() {
  const csv = 'full_name,email,specialty,institution\n"Dr. Juan Pérez","juan@ejemplo.com","Cardiología","Hospital General"\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'attendees_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportCsvModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation('admin');
  const bulkMutation = useBulkCreateAttendees();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({ title: t('attendees.importModal.invalidFormat'), variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast({ title: t('attendees.importModal.emptyFile'), variant: 'destructive' });
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file);
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    try {
      setProgress(10);
      const result = await bulkMutation.mutateAsync(rows);
      setProgress(100);
      toast({
        title: t('attendees.importModal.success', { count: result.inserted }),
        ...(result.errors > 0 && {
          description: t('attendees.importModal.errors', { count: result.errors }),
        }),
      });
      setTimeout(() => {
        setRows([]);
        setFileName('');
        setProgress(0);
        onOpenChange(false);
      }, 1000);
    } catch {
      toast({ title: t('attendees.newAttendeeModal.error'), variant: 'destructive' });
      setProgress(0);
    }
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t('attendees.importModal.title')}</DialogTitle>
        </DialogHeader>

        <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-fit">
          <Download className="mr-2 h-4 w-4" />
          {t('attendees.importModal.downloadTemplate')}
        </Button>

        {rows.length === 0 ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {t('attendees.importModal.dragDrop')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{t('attendees.importModal.selectedFile')}: <strong>{fileName}</strong></span>
            </div>

            <div className="text-sm font-medium text-foreground">{t('attendees.importModal.previewTitle')}</div>
            <div className="max-h-48 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Especialidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{r.full_name}</TableCell>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.specialty || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 10 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  +{rows.length - 10} más...
                </div>
              )}
            </div>

            {progress > 0 && <Progress value={progress} className="h-2" />}

            <Button
              className="w-full"
              onClick={handleImport}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending
                ? t('attendees.importModal.importing')
                : t('attendees.importModal.importButton', { count: rows.length })}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
