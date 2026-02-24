import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useEvent } from '@/hooks/useEvent';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/useNotes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Plus, ArrowLeft, Trash2, FileDown, StickyNote } from 'lucide-react';
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

  // Sessions for filter/selector
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(editorContent);
  const sessionRef = useRef(editorSession);

  contentRef.current = editorContent;
  sessionRef.current = editorSession;

  const dateFnsLocale = i18n.language?.startsWith('es') ? es : enUS;

  // Filtered notes
  const filteredNotes = filterSession === 'all'
    ? notes
    : notes.filter(n => filterSession === 'none' ? !n.session_id : n.session_id === filterSession);

  // Open editor
  const openEditor = (note: AttendeeNote) => {
    setEditingNote(note);
    setEditorContent(note.content ?? '');
    setEditorSession(note.session_id ?? 'none');
    setSaveStatus('idle');
  };

  // Create new note
  const handleNew = async () => {
    const newNote = await createNote.mutateAsync({ sessionId: null, content: '' });
    openEditor(newNote);
  };

  // Auto-save with 3s debounce
  const triggerSave = useCallback(() => {
    if (!editingNote) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateNote.mutateAsync({
          noteId: editingNote.id,
          content: contentRef.current,
          sessionId: sessionRef.current === 'none' ? null : sessionRef.current,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 3000);
  }, [editingNote, updateNote]);

  const handleContentChange = (value: string) => {
    setEditorContent(value);
    setSaveStatus('idle');
    triggerSave();
  };

  const handleSessionChange = (value: string) => {
    setEditorSession(value);
    setSaveStatus('idle');
    triggerSave();
  };

  // Save on close
  const closeEditor = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (editingNote) {
      await updateNote.mutateAsync({
        noteId: editingNote.id,
        content: contentRef.current,
        sessionId: sessionRef.current === 'none' ? null : sessionRef.current,
      });
    }
    setEditingNote(null);
  };

  // Delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteNote.mutateAsync(deleteTarget);
    toast({ description: t('deleted') });
    setDeleteTarget(null);
  };

  // Export PDF
  const handleExport = () => {
    window.print();
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- EDITOR VIEW ----
  if (editingNote) {
    return (
      <div className="flex flex-col h-[calc(100vh-128px)] bg-background">
        {/* Editor header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={closeEditor}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('back')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saving' && t('saving')}
            {saveStatus === 'saved' && t('saved')}
          </span>
        </div>

        {/* Session selector */}
        <div className="px-4 pt-3">
          <Select value={editorSession} onValueChange={handleSessionChange}>
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
        <div className="flex-1 px-4 py-3">
          <Textarea
            value={editorContent}
            onChange={e => handleContentChange(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full h-full resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base bg-background"
          />
        </div>

        {/* Export button */}
        <div className="px-4 pb-4">
          <Button variant="outline" className="w-full" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />
            {t('exportPdf')}
          </Button>
        </div>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          size="sm"
          onClick={handleNew}
          disabled={createNote.isPending}
          className="bg-[hsl(213,72%,37%)] hover:bg-[hsl(213,72%,30%)] text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('newNote')}
        </Button>
      </div>

      {/* Session filter */}
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

      {/* Loading */}
      {isLoading && <NoteSkeleton />}

      {/* Empty state */}
      {!isLoading && filteredNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">{t('empty')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('emptyAction')}</p>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-3">
        {filteredNotes.map(note => (
          <Card
            key={note.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
            onClick={() => openEditor(note)}
          >
            <div className="flex items-start justify-between">
              <Badge className="bg-[hsl(170,100%,36%)] hover:bg-[hsl(170,100%,30%)] text-white text-[11px] font-medium mb-2">
                {note.session_title ?? t('generalNote')}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
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

      {/* Delete confirmation */}
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
