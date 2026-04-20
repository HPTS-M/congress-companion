import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Mail, MessageCircle, Linkedin, Instagram, MapPin, Play, FileText, Eye, MousePointerClick, Download, Heart, Search, CheckCircle2, Info, BarChart3 } from 'lucide-react';
import { adminSponsorsService, type SponsorRow } from '@/services/admin-sponsors.service';
import { sponsorLeadsService, type SponsorLeadWithAttendee } from '@/services/sponsor-leads.service';
import { writeExcelFile } from '@/lib/excel';
import { toast } from 'sonner';
import { SponsorMaterialPreviewModal } from './SponsorMaterialPreviewModal';

interface Props {
  open: boolean;
  onClose: () => void;
  sponsor: SponsorRow | null;
}

const LEVEL_COLORS: Record<string, string> = {
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  bronze: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  exhibitor: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const LEVEL_LABELS: Record<string, string> = {
  gold: 'Oro', silver: 'Plata', bronze: 'Bronce', exhibitor: 'Expositor',
};

function buildWhatsAppLink(phone: string, message?: string | null): string {
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  const base = `https://wa.me/${cleaned}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function SponsorDetailDrawer({ open, onClose, sponsor }: Props) {
  const { t } = useTranslation('admin');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [leads, setLeads] = useState<SponsorLeadWithAttendee[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (sponsor?.logo_url) {
      adminSponsorsService.getSignedUrl(sponsor.logo_url).then(setLogoUrl).catch(() => setLogoUrl(null));
    } else {
      setLogoUrl(null);
    }
  }, [sponsor?.logo_url]);

  useEffect(() => {
    if (sponsor?.id && open) {
      setLeadsLoading(true);
      sponsorLeadsService.getLeadsForSponsor(sponsor.id)
        .then(setLeads)
        .catch(() => setLeads([]))
        .finally(() => setLeadsLoading(false));
    }
  }, [sponsor?.id, open]);

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const q = leadSearch.toLowerCase();
    return leads.filter(l =>
      l.attendees.full_name.toLowerCase().includes(q) ||
      (l.attendees.specialty ?? '').toLowerCase().includes(q) ||
      (l.attendees.institution ?? '').toLowerCase().includes(q)
    );
  }, [leads, leadSearch]);

  if (!sponsor) return null;

  const initials = sponsor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const exportLeads = async () => {
    try {
      await writeExcelFile({
        filename: `leads-${sponsor.name.replace(/\s+/g, '-').toLowerCase()}.xlsx`,
        sheetName: 'Leads',
        columns: [
          { header: 'nombre', key: 'nombre', width: 30 },
          { header: 'especialidad', key: 'especialidad', width: 20 },
          { header: 'organizacion', key: 'organizacion', width: 25 },
          { header: 'email', key: 'email', width: 25 },
          { header: 'whatsapp', key: 'whatsapp', width: 18 },
          { header: 'telefono', key: 'telefono', width: 18 },
          { header: 'fecha', key: 'fecha', width: 20 },
          { header: 'contactado', key: 'contactado', width: 20 },
        ],
        rows: leads.map(l => ({
          nombre: l.attendees.full_name,
          especialidad: l.attendees.specialty ?? '',
          organizacion: l.attendees.institution ?? '',
          email: l.attendees.email,
          whatsapp: l.attendees.phone ?? '',
          telefono: l.attendees.phone ?? '',
          fecha: new Date(l.created_at).toLocaleString(),
          contactado: l.contacted_at ? new Date(l.contacted_at).toLocaleString() : '',
        })),
      });
      toast.success(t('sponsors.leads.exportSuccess'));
    } catch {
      toast.error(t('sponsors.leads.exportError'));
    }
  };

  const handleMarkContacted = async (leadId: string) => {
    try {
      await sponsorLeadsService.markAsContacted(leadId);
      setLeads((prev) => prev.map(l => l.id === leadId ? { ...l, contacted_at: new Date().toISOString() } : l));
      toast.success(t('sponsors.leads.markedContacted'));
    } catch {
      toast.error(t('sponsors.leads.markError'));
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('sponsors.detailTitle')}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt={sponsor.name} className="h-16 w-16 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {initials}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{sponsor.name}</h3>
              <div className="flex gap-2 mt-1">
                <Badge className={LEVEL_COLORS[sponsor.level]}>{LEVEL_LABELS[sponsor.level] ?? sponsor.level}</Badge>
                <Badge variant="secondary">{t(`sponsors.cat_${sponsor.category}`)}</Badge>
              </div>
            </div>
          </div>

          {sponsor.description && (
            <p className="text-sm text-muted-foreground">{sponsor.description}</p>
          )}

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
              <TabsTrigger
                value="info"
                className="flex flex-col gap-1 py-2 px-1 text-[11px] sm:flex-row sm:gap-2 sm:text-sm"
              >
                <Info className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('sponsors.tabContact')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="flex flex-col gap-1 py-2 px-1 text-[11px] sm:flex-row sm:gap-2 sm:text-sm"
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('sponsors.tabStats')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="leads"
                className="flex flex-col gap-1 py-2 px-1 text-[11px] sm:flex-row sm:gap-2 sm:text-sm"
              >
                <Heart className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {t('sponsors.tabLeads')}{leads.length > 0 ? ` (${leads.length})` : ''}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Contact info tab */}
            <TabsContent value="info" className="space-y-3 mt-4">
              {sponsor.stand_location && (
                <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {sponsor.stand_location}</div>
              )}
              {sponsor.website_url && (
                <div className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-muted-foreground" /> <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{sponsor.website_url}</a></div>
              )}
              {sponsor.contact_email && (
                <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {sponsor.contact_email}</div>
              )}
              {sponsor.whatsapp && (
                <div className="flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4 text-muted-foreground" /> {sponsor.whatsapp}</div>
              )}
              {sponsor.social_linkedin && (
                <div className="flex items-center gap-2 text-sm"><Linkedin className="h-4 w-4 text-muted-foreground" /> {sponsor.social_linkedin}</div>
              )}
              {sponsor.social_instagram && (
                <div className="flex items-center gap-2 text-sm"><Instagram className="h-4 w-4 text-muted-foreground" /> {sponsor.social_instagram}</div>
              )}
              {sponsor.video_url && (
                <div className="flex items-center gap-2 text-sm"><Play className="h-4 w-4 text-muted-foreground" /> <a href={sponsor.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{sponsor.video_url}</a></div>
              )}
              {sponsor.materials_url && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{t('sponsors.hasMaterials')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="w-full flex items-center gap-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors p-3 text-left"
                  >
                    <div className="h-12 w-12 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {(sponsor.materials_url.split('/').pop() ?? 'document.pdf')}
                      </p>
                      <p className="text-xs text-muted-foreground">PDF · {t('sponsors.preview.open')}</p>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
              )}
            </TabsContent>

            {/* Stats tab */}
            <TabsContent value="stats" className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <Eye className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-lg font-bold text-foreground">{sponsor.profile_views}</p>
                  <p className="text-xs text-muted-foreground">{t('sponsors.statViews')}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <MousePointerClick className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-lg font-bold text-foreground">{sponsor.whatsapp_clicks}</p>
                  <p className="text-xs text-muted-foreground">{t('sponsors.statWhatsapp')}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <Globe className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-lg font-bold text-foreground">{sponsor.website_clicks}</p>
                  <p className="text-xs text-muted-foreground">{t('sponsors.statWebsite')}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <Download className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-lg font-bold text-foreground">{sponsor.materials_downloads}</p>
                  <p className="text-xs text-muted-foreground">{t('sponsors.statMaterials')}</p>
                </div>
              </div>
            </TabsContent>

            {/* Leads tab */}
            <TabsContent value="leads" className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <Heart className="inline h-4 w-4 mr-1" />
                  {t('sponsors.leads.count', { count: leads.length })}
                </p>
                {leads.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportLeads}>
                    <Download className="mr-1 h-4 w-4" /> {t('sponsors.leads.export')}
                  </Button>
                )}
              </div>

              {leads.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder={t('sponsors.leads.search')}
                    className="pl-9"
                  />
                </div>
              )}

              {leadsLoading ? (
                <p className="text-sm text-muted-foreground">{t('sponsors.leads.loading')}</p>
              ) : filteredLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t('sponsors.leads.noLeads')}</p>
              ) : (
                <div className="space-y-2">
                  {filteredLeads.map(lead => {
                    const phone = lead.attendees.phone;
                    const email = lead.attendees.email;
                    return (
                      <div key={lead.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {lead.attendees.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{lead.attendees.full_name}</p>
                            {lead.contacted_at && (
                              <Badge variant="secondary" className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> {t('sponsors.leads.alreadyContacted')}
                              </Badge>
                            )}
                          </div>
                          {lead.attendees.specialty && (
                            <p className="text-xs text-muted-foreground">{lead.attendees.specialty}</p>
                          )}
                          {lead.attendees.institution && (
                            <p className="text-xs text-muted-foreground">{lead.attendees.institution}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-2">
                            {email ? (
                              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                                <a href={`mailto:${email}`} title={t('sponsors.leads.contactEmail')}>
                                  <Mail className="h-3 w-3 mr-1" /> {t('sponsors.leads.contactEmail')}
                                </a>
                              </Button>
                            ) : null}
                            {phone ? (
                              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                                <a href={buildWhatsAppLink(phone)} target="_blank" rel="noopener noreferrer" title={t('sponsors.leads.contactWhatsapp')}>
                                  <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                                </a>
                              </Button>
                            ) : null}
                            {!lead.contacted_at && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleMarkContacted(lead.id)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> {t('sponsors.leads.markContacted')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <SponsorMaterialPreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      filePath={sponsor.materials_url}
    />
    </>
  );
}
