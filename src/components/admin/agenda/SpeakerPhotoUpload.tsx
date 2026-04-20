import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { adminAgendaService } from '@/services/admin-agenda.service';
import { toast } from 'sonner';

interface SpeakerPhotoUploadProps {
  eventId: string;
  value: string | null | undefined;
  onChange: (path: string | null) => void;
}

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export function SpeakerPhotoUpload({ eventId, value, onChange }: SpeakerPhotoUploadProps) {
  const { t } = useTranslation('admin');
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (value) {
      adminAgendaService.getSpeakerPhotoUrl(value).then((url) => {
        if (!cancelled) setPreviewUrl(url);
      });
    } else {
      setPreviewUrl(null);
    }
    return () => { cancelled = true; };
  }, [value]);

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error(t('agenda.sessionModal.photoInvalidType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('agenda.sessionModal.photoTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const path = await adminAgendaService.uploadSpeakerPhoto(eventId, file);
      onChange(path);
      toast.success(t('agenda.sessionModal.photoUploaded'));
    } catch {
      toast.error(t('agenda.sessionModal.photoUploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (value) await adminAgendaService.deleteSpeakerPhoto(value);
    onChange(null);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Avatar
        className="h-20 w-20 border border-border cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl && <AvatarImage src={previewUrl} alt="Speaker" />}
        <AvatarFallback className="bg-muted">
          <User className="h-8 w-8 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1.5 w-full sm:w-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !eventId}
          className="w-full sm:w-auto"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {value ? t('agenda.sessionModal.photoChange') : t('agenda.sessionModal.photoUpload')}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-destructive hover:text-destructive h-7 w-full sm:w-auto"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t('agenda.sessionModal.photoRemove')}
          </Button>
        )}
        <p className="text-[10px] text-muted-foreground">{t('agenda.sessionModal.photoHint')}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
