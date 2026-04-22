import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/useNotes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Plus, ArrowLeft, Trash2, FileDown, StickyNote, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { AttendeeNote } from '@/services/notes.service';

function NoteSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Card key={i} className="p-4">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-20 mt-2 ml-auto" />
        </Card>
      ))}
    </div>
  );
}

export default function Notes() {
  const { t, i18n } = useTranslation('notes');
  const { attendee } = useAuth();
  const { event } = useEvent();
  const { toast } = useToast();

  const eventId = event?.id ?? '';
  const attendeeId = attendee?.id ?? '';

  const { data: notes = [], isLoading } = useNotes(eventId, attendeeId);
  const createNote = useCreateNote(eventId, attendeeId);
  const updateNote = useUpdateNote(eventId, attendeeId);
  const deleteNote = useDeleteNote(eventId, attendeeId);

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions-for-notes', eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_activities')
        .select('id, title')
        .eq('event_id', eventId)
        .order('scheduled_date')
        .order('start_time');
      return data ?? [];
    },
    enabled: !!eventId,
  });

  const [filterSession, setFilterSession] = useState<string>('all');
  const [editingNote, setEditingNote] = useState<AttendeeNote | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorSession, setEditorSession] = useState<string>('none');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportLockRef = useRef(false);

  const dateFnsLocale = i18n.language?.startsWith('es') ? es : enUS;

  const filteredNotes = filterSession === 'all'
    ? notes
    : notes.filter(n => filterSession === 'none' ? !n.session_id : n.session_id === filterSession);

  // Track unsaved state by comparing local editor with server note
  const baseSession = editingNote?.session_id ?? 'none';
  const baseContent = editingNote?.content ?? '';
  const hasUnsavedChanges = !!editingNote && (
    editorContent !== baseContent || editorSession !== baseSession
  );

  const openEditor = (note: AttendeeNote) => {
    setEditingNote(note);
    setEditorContent(note.content ?? '');
    setEditorSession(note.session_id ?? 'none');
  };

  const handleNew = async () => {
    try {
      const newNote = await createNote.mutateAsync({ sessionId: null, content: '' });
      openEditor(newNote);
    } catch {
      toast({ description: t('common:error', { defaultValue: 'Error' }), variant: 'destructive' });
    }
  };

  const persistNote = async (): Promise<boolean> => {
    if (!editingNote) return false;
    try {
      const updated = await updateNote.mutateAsync({
        noteId: editingNote.id,
        content: editorContent,
        sessionId: editorSession === 'none' ? null : editorSession,
      });
      // Refresh local baseline so unsaved indicator clears
      setEditingNote(prev => prev ? {
        ...prev,
        content: editorContent,
        session_id: editorSession === 'none' ? null : editorSession,
        updated_at: (updated as AttendeeNote)?.updated_at ?? new Date().toISOString(),
      } : prev);
      return true;
    } catch {
      toast({ description: t('common:error', { defaultValue: 'Error' }), variant: 'destructive' });
      return false;
    }
  };

  const handleSave = async () => {
    const ok = await persistNote();
    if (ok) toast({ description: t('noteSaved') });
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    setEditingNote(null);
  };

  const handleDiscardAndExit = () => {
    setDiscardDialogOpen(false);
    setEditingNote(null);
  };

  const handleSaveAndExit = async () => {
    const ok = await persistNote();
    setDiscardDialogOpen(false);
    if (ok) setEditingNote(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteNote.mutateAsync(deleteTarget);
    toast({ description: t('deleted') });
    setDeleteTarget(null);
  };

  // Real PDF export using jsPDF (lazy imported)
  const handleExport = async () => {
    if (!editingNote || exportLockRef.current) return;
    exportLockRef.current = true;
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const sessionTitle = sessions.find(s => s.id === editorSession)?.title ?? t('generalNote');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 20;
      const lineHeight = 7;
      let y = margin;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(sessionTitle, margin, y);
      y += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      const body = editorContent || '';
      const lines = pdf.splitTextToSize(body, 170);
      for (const line of lines) {
        if (y > 280) { pdf.addPage(); y = margin; }
        pdf.text(line, margin, y);
        y += lineHeight;
      }

      pdf.save(`nota-${editingNote.id.slice(0, 8)}.pdf`);
    } catch {
      toast({ description: t('exportError'), variant: 'destructive' });
    } finally {
      exportLockRef.current = false;
      setIsExporting(false);
    }
  };

  // ---- EDITOR VIEW ----
  if (editingNote) {
    return (
      <div className="flex flex-col h-[calc(100vh-128px)] bg-background">
        {/* Editor header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('back')}
          </Button>
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium truncate">
              {t('unsavedChanges')}
            </span>
          )}
        </div>

        {/* Session selector */}
        <div className="px-4 pt-3">
          <Select value={editorSession} onValueChange={setEditorSession}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectSession')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('generalNote')}</SelectItem>
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Textarea */}
        <div className="flex-1 px-4 py-3 min-h-0">
          <Textarea
            value={editorContent}
            onChange={e => setEditorContent(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full h-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base bg-background"
          />
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          <Button
            className="w-full bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || updateNote.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {t('save')}
          </Button>
          <Button variant="outline" className="w-full" onClick={handleExport} disabled={isExporting}>
            <FileDown className="h-4 w-4 mr-2" />
            {t('exportPdf')}
          </Button>
        </div>

        {/* Discard changes dialog */}
        <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('discardTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('discardDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel className="mt-0">{t('keepEditing')}</AlertDialogCancel>
              <Button variant="destructive" onClick={handleDiscardAndExit}>
                {t('discard')}
              </Button>
              <AlertDialogAction onClick={handleSaveAndExit} disabled={updateNote.isPending}>
                {t('saveAndExit')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          size="sm"
          onClick={handleNew}
          disabled={createNote.isPending}
          className="bg-[hsl(213,72%,37%)] hover:bg-[hsl(213,72%,30%)] text-white shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('newNote')}
        </Button>
      </div>

      <div className="mb-4">
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('allSessions')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSessions')}</SelectItem>
            <SelectItem value="none">{t('generalNote')}</SelectItem>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <NoteSkeleton />}

      {!isLoading && filteredNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">{t('empty')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('emptyAction')}</p>
        </div>
      )}

      <div className="space-y-3">
        {filteredNotes.map(note => (
          <Card
            key={note.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
            onClick={() => openEditor(note)}
          >
            <div className="flex items-start justify-between gap-2">
              <Badge className="bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white text-[11px] font-medium mb-2 max-w-full truncate">
                {note.session_title ?? t('generalNote')}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={e => { e.stopPropagation(); setDeleteTarget(note.id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {note.content || t('placeholder')}
            </p>
            {note.updated_at && (
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: dateFnsLocale })}
              </p>
            )}
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
