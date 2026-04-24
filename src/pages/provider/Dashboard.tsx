import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, Bus, UtensilsCrossed, Map, Sparkles, Users, ChevronRight } from 'lucide-react';
import { providerPortalService } from '@/services/provider-portal.service';
import { useProviderSession } from '@/hooks/useProviderSession';

const TYPE_ICONS: Record<string, React.ElementType> = {
  transport: Bus, food: UtensilsCrossed, tour: Map, special: Sparkles,
};

export default function ProviderDashboard() {
  const { t } = useTranslation('provider');
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const navigate = useNavigate();
  const { session, isLoading: sessionLoading, logout } = useProviderSession();
  const providerId = session?.provider_id;

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['provider-services', providerId] as const,
    queryFn: () => {
      if (!providerId) throw new Error('Provider session not ready');
      return providerPortalService.getServices(providerId);
    },
    enabled: !!providerId,
  });

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 shadow-md"
        style={{ background: 'linear-gradient(135deg, #1A56A0 0%, #00B89F 100%)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-white">{session.company_name}</h1>
            <p className="text-xs text-white/70">{session.event_name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { void logout(); }} className="text-white hover:bg-white/10">
            <LogOut className="mr-1 h-4 w-4" /> {t('logout')}
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('assignedServices')}</h2>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('noServices')}
            </CardContent>
          </Card>
        ) : (
          services.map((s) => {
            const Icon = TYPE_ICONS[s.service_type] ?? Bus;
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/${eventSlug}/provider/service/${s.id}`)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{s.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {s.location && <span>{s.location}</span>}
                      {s.valid_from && s.valid_until && (
                        <span>· {s.valid_from.slice(0, 5)} – {s.valid_until.slice(0, 5)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {s.attendee_count}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
