import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminSponsorsService, type SponsorRow, type SponsorFormData } from '@/services/admin-sponsors.service';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  sponsor?: SponsorRow | null;
  onSaved: () => void;
}

const LEVELS = ['gold', 'silver', 'bronze', 'exhibitor'] as const;
const CATEGORIES = ['pharmaceutical', 'technology', 'medical_equipment', 'services', 'education', 'other'] as const;

export function SponsorModal({ open, onClose, eventId, sponsor, onSaved }: Props) {
  const { t } = useTranslation('admin');
  const isEdit = !!sponsor;

  const [name, setName] = useState(sponsor?.name ?? '');
  const [level, setLevel] = useState(sponsor?.level ?? 'gold');
  const [category, setCategory] = useState(sponsor?.category ?? 'pharmaceutical');
  const [description, setDescription] = useState(sponsor?.description ?? '');
  const [standLocation, setStandLocation] = useState(sponsor?.stand_location ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(sponsor?.website_url ?? '');
  const [contactEmail, setContactEmail] = useState(sponsor?.contact_email ?? '');
  const [whatsapp, setWhatsapp] = useState(sponsor?.whatsapp ?? '');
  const [whatsappMessage, setWhatsappMessage] = useState(sponsor?.whatsapp_message ?? '');
  const [videoUrl, setVideoUrl] = useState(sponsor?.video_url ?? '');
  const [linkedin, setLinkedin] = useState(sponsor?.social_linkedin ?? '');
  const [instagram, setInstagram] = useState(sponsor?.social_instagram ?? '');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [materialsFile, setMaterialsFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const materialsRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { toast.error(t('sponsors.nameRequired')); return; }
    setSaving(true);
    try {
      let logoUrl = sponsor?.logo_url ?? null;
      let materialsUrl = sponsor?.materials_url ?? null;

      if (logoFile) {
        if (logoFile.size > 2 * 1024 * 1024) { toast.error(t('sponsors.logoTooLarge')); setSaving(false); return; }
        const path = await adminSponsorsService.uploadFile(eventId, logoFile, 'logo');
        logoUrl = path;
      }
      if (materialsFile) {
        if (materialsFile.size > 10 * 1024 * 1024) { toast.error(t('sponsors.materialsTooLarge')); setSaving(false); return; }
        const path = await adminSponsorsService.uploadFile(eventId, materialsFile, 'materials');
        materialsUrl = path;
      }

      const form: SponsorFormData & { logo_url?: string | null; materials_url?: string | null } = {
        name: name.trim(),
        level,
        category,
        description: description.trim() || undefined,
        stand_location: standLocation.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        whatsapp_message: whatsappMessage.trim() || undefined,
        video_url: videoUrl.trim() || undefined,
        social_linkedin: linkedin.trim() || undefined,
        social_instagram: instagram.trim() || undefined,
        logo_url: logoUrl,
        materials_url: materialsUrl,
      };

      if (isEdit) {
        await adminSponsorsService.update(sponsor!.id, form);
      } else {
        await adminSponsorsService.create(eventId, form as SponsorFormData);
      }
      toast.success(t(isEdit ? 'sponsors.editSuccess' : 'sponsors.createSuccess'));
      onSaved();
      onClose();
    } catch {
      toast.error(t(isEdit ? 'sponsors.editError' : 'sponsors.createError'));
    } finally {
      setSaving(false);
    }
  }, [name, level, category, description, standLocation, websiteUrl, contactEmail, whatsapp, whatsappMessage, videoUrl, linkedin, instagram, logoFile, materialsFile, eventId, sponsor, isEdit, onSaved, onClose, t]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? 'sponsors.editTitle' : 'sponsors.newTitle')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label>{t('sponsors.fieldName')} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('sponsors.fieldNamePlaceholder')} />
          </div>

          {/* Level + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t('sponsors.fieldLevel')}</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{t(`sponsors.level_${l}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('sponsors.fieldCategory')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`sponsors.cat_${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logo upload */}
          <div className="grid gap-1.5">
            <Label>{t('sponsors.fieldLogo')}</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> {t('sponsors.selectImage')}
              </Button>
              {logoFile && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {logoFile.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setLogoFile(null)} />
                </span>
              )}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </div>
            <p className="text-xs text-muted-foreground">{t('sponsors.logoMaxSize')}</p>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label>{t('sponsors.fieldDescription')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Stand location */}
          <div className="grid gap-1.5">
            <Label>{t('sponsors.fieldStand')}</Label>
            <Input value={standLocation} onChange={(e) => setStandLocation(e.target.value)} placeholder={t('sponsors.fieldStandPlaceholder')} />
          </div>

          {/* Website + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t('sponsors.fieldWebsite')}</Label>
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('sponsors.fieldEmail')}</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t('sponsors.fieldWhatsapp')}</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="57XXXXXXXXXX" />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('sponsors.fieldWhatsappMsg')}</Label>
              <Input value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} placeholder={t('sponsors.fieldWhatsappMsgPlaceholder')} />
            </div>
          </div>

          {/* Video URL */}
          <div className="grid gap-1.5">
            <Label>{t('sponsors.fieldVideo')}</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
          </div>

          {/* Social */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>LinkedIn</Label>
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/..." />
            </div>
            <div className="grid gap-1.5">
              <Label>Instagram</Label>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@empresa" />
            </div>
          </div>

          {/* Materials PDF */}
          <div className="grid gap-1.5">
            <Label>{t('sponsors.fieldMaterials')}</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => materialsRef.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> {t('sponsors.selectFile')}
              </Button>
              {materialsFile && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {materialsFile.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setMaterialsFile(null)} />
                </span>
              )}
              <input ref={materialsRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setMaterialsFile(e.target.files?.[0] ?? null)} />
            </div>
            <p className="text-xs text-muted-foreground">{t('sponsors.materialsMaxSize')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('sponsors.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? t('sponsors.saving') : t('sponsors.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
