import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { adminSponsorsService, type SponsorRow, type SponsorFormData } from '@/services/admin-sponsors.service';
import { useAdminSponsors } from '@/hooks/useAdminSponsors';
import { SponsorMaterialPreviewModal } from './SponsorMaterialPreviewModal';
import {
  PhoneInputWithCountry,
  parsePhoneE164,
  buildPhoneE164,
} from './PhoneInputWithCountry';
import {
  validateFile,
  formatFileSize,
  SPONSOR_LOGO_MIME,
  SPONSOR_LOGO_EXT,
  SPONSOR_LOGO_MAX,
  SPONSOR_MATERIALS_MIME,
  SPONSOR_MATERIALS_EXT,
  SPONSOR_MATERIALS_MAX,
  type FileValidationResult,
} from '@/lib/file-validation';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  sponsor?: SponsorRow | null;
  onSaved: () => void;
}

const LEVELS = ['gold', 'silver', 'bronze', 'exhibitor'] as const;
const CATEGORIES = ['pharmaceutical', 'technology', 'medical_equipment', 'services', 'education', 'other'] as const;

const WHATSAPP_REGEX = /^\+?[1-9]\d{7,14}$/;
const URL_REGEX = /^https?:\/\/.+/i;

function logoErrorKey(r: FileValidationResult): string {
  if (r.code === 'too_large') return 'fileSizeLogo';
  if (r.code === 'empty') return 'fileEmpty';
  return 'fileTypeLogo';
}

function materialsErrorKey(r: FileValidationResult): string {
  if (r.code === 'too_large') return 'fileSizeMaterials';
  if (r.code === 'empty') return 'fileEmpty';
  return 'fileTypeMaterials';
}

type Errors = Partial<Record<
  'name' | 'description' | 'website_url' | 'contact_email' | 'whatsapp' | 'video_url' | 'social_linkedin' | 'social_instagram',
  string
>>;

export function SponsorModal({ open, onClose, eventId, sponsor, onSaved }: Props) {
  const { t } = useTranslation('admin');
  const isEdit = !!sponsor;
  const { createSponsor, updateSponsor, isCreating, isUpdating } = useAdminSponsors(eventId);

  const [name, setName] = useState(sponsor?.name ?? '');
  const [level, setLevel] = useState(sponsor?.level ?? 'gold');
  const [category, setCategory] = useState(sponsor?.category ?? 'pharmaceutical');
  const [description, setDescription] = useState(sponsor?.description ?? '');
  const [standLocation, setStandLocation] = useState(sponsor?.stand_location ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(sponsor?.website_url ?? '');
  const [contactEmail, setContactEmail] = useState(sponsor?.contact_email ?? '');
  const initialPhone = useMemo(() => parsePhoneE164(sponsor?.whatsapp ?? null), [sponsor?.whatsapp]);
  const [whatsappDialCode, setWhatsappDialCode] = useState(initialPhone.dialCode);
  const [whatsappNumber, setWhatsappNumber] = useState(initialPhone.number);
  const [whatsappMessage, setWhatsappMessage] = useState(sponsor?.whatsapp_message ?? '');
  const [videoUrl, setVideoUrl] = useState(sponsor?.video_url ?? '');
  const [linkedin, setLinkedin] = useState(sponsor?.social_linkedin ?? '');
  const [instagram, setInstagram] = useState(sponsor?.social_instagram ?? '');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [materialsFile, setMaterialsFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeMaterials, setRemoveMaterials] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ existingId: string; name: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const materialsRef = useRef<HTMLInputElement>(null);

  const saving = isCreating || isUpdating;
  const currentLogoPath = sponsor?.logo_url ?? null;
  const currentMaterialsPath = sponsor?.materials_url ?? null;

  // Resolve current logo signed URL for preview
  useEffect(() => {
    if (!currentLogoPath || removeLogo || logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    let cancelled = false;
    adminSponsorsService.getSignedUrl(currentLogoPath)
      .then((u) => { if (!cancelled) setLogoPreviewUrl(u); })
      .catch(() => { if (!cancelled) setLogoPreviewUrl(null); });
    return () => { cancelled = true; };
  }, [currentLogoPath, removeLogo, logoFile]);

  // Build Zod schema (memoized with translations)
  const schema = useMemo(() => z.object({
    name: z.string()
      .trim()
      .min(1, t('sponsors.validation.nameRequired'))
      .min(2, t('sponsors.validation.nameMin'))
      .max(100, t('sponsors.validation.nameMax')),
    description: z.string().max(500, t('sponsors.validation.descriptionMax')).optional(),
    website_url: z.string().regex(URL_REGEX, t('sponsors.validation.urlFormat')).optional().or(z.literal('')),
    video_url: z.string().regex(URL_REGEX, t('sponsors.validation.urlFormat')).optional().or(z.literal('')),
    social_linkedin: z.string().regex(URL_REGEX, t('sponsors.validation.urlFormat')).optional().or(z.literal('')),
    social_instagram: z.string().optional(),
    contact_email: z.string().email(t('sponsors.validation.emailFormat')).optional().or(z.literal('')),
    whatsapp: z.string().optional(),
  }), [t]);

  const validate = useCallback((): boolean => {
    const composedWhatsapp = buildPhoneE164(whatsappDialCode, whatsappNumber);
    const result = schema.safeParse({
      name,
      description: description || undefined,
      website_url: websiteUrl || undefined,
      video_url: videoUrl || undefined,
      social_linkedin: linkedin || undefined,
      social_instagram: instagram || undefined,
      contact_email: contactEmail || undefined,
      whatsapp: composedWhatsapp || undefined,
    });

    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (composedWhatsapp && !WHATSAPP_REGEX.test(composedWhatsapp)) {
      next.whatsapp = t('sponsors.validation.whatsappFormat');
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error(t('sponsors.validation.fixErrors'));
      return false;
    }
    return true;
  }, [schema, name, description, websiteUrl, videoUrl, linkedin, instagram, contactEmail, whatsappDialCode, whatsappNumber, t]);

  const buildForm = useCallback(
    (logoUrl: string | null, materialsUrl: string | null): SponsorFormData & { logo_url?: string | null; materials_url?: string | null } => ({
      name: name.trim(),
      level,
      category,
      description: description.trim() || undefined,
      stand_location: standLocation.trim() || undefined,
      website_url: websiteUrl.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      whatsapp: buildPhoneE164(whatsappDialCode, whatsappNumber) || undefined,
      whatsapp_message: whatsappMessage.trim() || undefined,
      video_url: videoUrl.trim() || undefined,
      social_linkedin: linkedin.trim() || undefined,
      social_instagram: instagram.trim() || undefined,
      logo_url: logoUrl,
      materials_url: materialsUrl,
    }),
    [name, level, category, description, standLocation, websiteUrl, contactEmail, whatsappDialCode, whatsappNumber, whatsappMessage, videoUrl, linkedin, instagram]
  );

  const handleLogoSelect = useCallback((file: File | null) => {
    if (!file) { setLogoFile(null); return; }
    const result = validateFile(file, SPONSOR_LOGO_MIME, SPONSOR_LOGO_EXT, SPONSOR_LOGO_MAX);
    if (!result.ok) {
      toast.error(t(`sponsors.validation.${logoErrorKey(result)}`));
      if (logoRef.current) logoRef.current.value = '';
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
  }, [t]);

  const handleMaterialsSelect = useCallback((file: File | null) => {
    if (!file) { setMaterialsFile(null); return; }
    const result = validateFile(file, SPONSOR_MATERIALS_MIME, SPONSOR_MATERIALS_EXT, SPONSOR_MATERIALS_MAX);
    if (!result.ok) {
      toast.error(t(`sponsors.validation.${materialsErrorKey(result)}`));
      if (materialsRef.current) materialsRef.current.value = '';
      return;
    }
    setMaterialsFile(file);
    setRemoveMaterials(false);
  }, [t]);

  const performSave = useCallback(async (force = false) => {
    // Defense in depth: re-validate before upload (handlers should already have caught these)
    if (logoFile) {
      const r = validateFile(logoFile, SPONSOR_LOGO_MIME, SPONSOR_LOGO_EXT, SPONSOR_LOGO_MAX);
      if (!r.ok) { toast.error(t(`sponsors.validation.${logoErrorKey(r)}`)); return; }
    }
    if (materialsFile) {
      const r = validateFile(materialsFile, SPONSOR_MATERIALS_MIME, SPONSOR_MATERIALS_EXT, SPONSOR_MATERIALS_MAX);
      if (!r.ok) { toast.error(t(`sponsors.validation.${materialsErrorKey(r)}`)); return; }
    }

    try {
      // Duplicate check on create
      if (!isEdit && !force) {
        const existing = await adminSponsorsService.findByName(eventId, name);
        if (existing) {
          setDuplicatePrompt({ existingId: existing.id, name: existing.name });
          return;
        }
      }

      // Parallel uploads with post-upload verification (inside service)
      const [logoUpload, materialsUpload] = await Promise.all([
        logoFile ? adminSponsorsService.uploadFile(eventId, logoFile, 'logo') : Promise.resolve(null),
        materialsFile ? adminSponsorsService.uploadFile(eventId, materialsFile, 'materials') : Promise.resolve(null),
      ]);

      const finalLogoUrl = logoUpload?.path ?? (removeLogo ? null : currentLogoPath);
      const finalMaterialsUrl = materialsUpload?.path ?? (removeMaterials ? null : currentMaterialsPath);
      const form = buildForm(finalLogoUrl, finalMaterialsUrl);

      if (isEdit && sponsor) {
        await updateSponsor({ id: sponsor.id, form });
        toast.success(t('sponsors.editSuccess'));
      } else {
        await createSponsor(form as SponsorFormData);
        toast.success(t('sponsors.createSuccess'));
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'upload_verification_failed') {
        toast.error(t('sponsors.validation.uploadVerificationFailed'));
      } else {
        toast.error(t(isEdit ? 'sponsors.editError' : 'sponsors.createError'));
      }
    }
  }, [logoFile, materialsFile, isEdit, eventId, name, removeLogo, currentLogoPath, removeMaterials, currentMaterialsPath, buildForm, sponsor, updateSponsor, createSponsor, onSaved, onClose, t]);

  const handleSave = useCallback(() => {
    if (!validate()) return;
    void performSave(false);
  }, [validate, performSave]);

  const errClass = (k: keyof Errors) => errors[k] ? 'border-destructive' : '';

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t(isEdit ? 'sponsors.editTitle' : 'sponsors.newTitle')}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">{t('sponsors.detailContact')}</TabsTrigger>
              <TabsTrigger value="contact">{t('sponsors.fieldWhatsapp')} / {t('sponsors.fieldMaterials')}</TabsTrigger>
            </TabsList>

            {/* BASIC */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid gap-1.5">
                <Label>{t('sponsors.fieldName')} *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('sponsors.fieldNamePlaceholder')}
                  className={errClass('name')}
                  maxLength={100}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

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

              <div className="grid gap-1.5">
                <Label>{t('sponsors.fieldDescription')}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className={errClass('description')}
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/500</p>
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              <div className="grid gap-1.5">
                <Label>{t('sponsors.fieldStand')}</Label>
                <Input value={standLocation} onChange={(e) => setStandLocation(e.target.value)} placeholder={t('sponsors.fieldStandPlaceholder')} />
              </div>

              {/* Logo */}
              <div className="grid gap-1.5">
                <Label>{t('sponsors.fieldLogo')}</Label>
                <div className="flex items-center gap-3">
                  {logoPreviewUrl && !logoFile && (
                    <img src={logoPreviewUrl} alt="logo" className="h-16 w-16 rounded-md object-cover border border-border" />
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                        <Upload className="mr-1 h-4 w-4" />
                        {logoPreviewUrl || logoFile ? t('sponsors.preview.replace') : t('sponsors.selectImage')}
                      </Button>
                      {logoFile && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {logoFile.name} ({formatFileSize(logoFile.size)})
                          <X className="h-3 w-3 cursor-pointer" onClick={() => { setLogoFile(null); if (logoRef.current) logoRef.current.value = ''; }} />
                        </span>
                      )}
                      {logoPreviewUrl && !logoFile && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoveLogo(true)}>
                          {t('sponsors.preview.remove')}
                        </Button>
                      )}
                    </div>
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-muted-foreground">{t('sponsors.logoMaxSize')}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* CONTACT & MATERIALS */}
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t('sponsors.fieldWebsite')}</Label>
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." className={errClass('website_url')} />
                  {errors.website_url && <p className="text-xs text-destructive">{errors.website_url}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t('sponsors.fieldEmail')}</Label>
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={errClass('contact_email')} />
                  {errors.contact_email && <p className="text-xs text-destructive">{errors.contact_email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t('sponsors.fieldWhatsapp')}</Label>
                  <PhoneInputWithCountry
                    dialCode={whatsappDialCode}
                    number={whatsappNumber}
                    onDialCodeChange={setWhatsappDialCode}
                    onNumberChange={setWhatsappNumber}
                    invalid={!!errors.whatsapp}
                  />
                  <p className="text-xs text-muted-foreground">{t('sponsors.validation.whatsappHelp')}</p>
                  {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t('sponsors.fieldWhatsappMsg')}</Label>
                  <Input value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} placeholder={t('sponsors.fieldWhatsappMsgPlaceholder')} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>{t('sponsors.fieldVideo')}</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className={errClass('video_url')} />
                {errors.video_url && <p className="text-xs text-destructive">{errors.video_url}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>LinkedIn</Label>
                  <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/..." className={errClass('social_linkedin')} />
                  {errors.social_linkedin && <p className="text-xs text-destructive">{errors.social_linkedin}</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>Instagram</Label>
                  <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@empresa" />
                </div>
              </div>

              {/* Materials PDF */}
              <div className="grid gap-1.5">
                <Label>{t('sponsors.fieldMaterials')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => materialsRef.current?.click()}>
                    <Upload className="mr-1 h-4 w-4" />
                    {currentMaterialsPath || materialsFile ? t('sponsors.preview.replace') : t('sponsors.selectFile')}
                  </Button>
                  {materialsFile && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {materialsFile.name} ({formatFileSize(materialsFile.size)})
                      <X className="h-3 w-3 cursor-pointer" onClick={() => { setMaterialsFile(null); if (materialsRef.current) materialsRef.current.value = ''; }} />
                    </span>
                  )}
                  {currentMaterialsPath && !materialsFile && !removeMaterials && (
                    <>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {t('sponsors.preview.currentMaterial')}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
                        <Eye className="mr-1 h-3 w-3" /> {t('sponsors.preview.open')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoveMaterials(true)}>
                        {t('sponsors.preview.remove')}
                      </Button>
                    </>
                  )}
                  <input
                    ref={materialsRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleMaterialsSelect(e.target.files?.[0] ?? null)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('sponsors.materialsMaxSize')}</p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>{t('sponsors.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? t('sponsors.saving') : t('sponsors.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate confirmation */}
      <AlertDialog open={!!duplicatePrompt} onOpenChange={(o) => !o && setDuplicatePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sponsors.duplicate.foundTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sponsors.duplicate.foundMessage', { name: duplicatePrompt?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sponsors.duplicate.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicatePrompt(null);
                void performSave(true);
              }}
            >
              {t('sponsors.duplicate.continueAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Material preview while editing */}
      <SponsorMaterialPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        filePath={currentMaterialsPath}
      />
    </>
  );
}
