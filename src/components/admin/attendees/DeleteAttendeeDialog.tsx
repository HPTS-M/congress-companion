import { useTranslation } from 'react-i18next';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useDeleteAttendee } from '@/hooks/useAdminAttendees';

interface Props {
  attendee: { id: string; name: string } | null;
  onClose: () => void;
}

export function DeleteAttendeeDialog({ attendee, onClose }: Props) {
  const { t } = useTranslation('admin');
  const deleteMutation = useDeleteAttendee();

  const handleDelete = async () => {
    if (!attendee) return;
    try {
      await deleteMutation.mutateAsync(attendee.id);
      toast({ title: t('attendees.deleteConfirm.success') });
      onClose();
    } catch {
      toast({ title: t('attendees.deleteConfirm.error'), variant: 'destructive' });
    }
  };

  return (
    <AlertDialog open={!!attendee} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('attendees.deleteConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('attendees.deleteConfirm.message', { name: attendee?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('attendees.deleteConfirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('attendees.deleteConfirm.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
