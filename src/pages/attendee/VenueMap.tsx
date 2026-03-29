import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEventSlug } from '@/hooks/useEvent';
import { Button } from '@/components/ui/button';

export default function VenueMap() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const eventSlug = useEventSlug();

  return (
    <div className="flex flex-col h-[100dvh] bg-muted">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button
          onClick={() => navigate(`/${eventSlug}/home`)}
          className="text-foreground"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          {t('venueMap.title')}
        </h1>
      </div>

      {/* Hint */}
      <p className="mx-4 my-2 text-xs text-muted-foreground">
        {t('venueMap.hint')}
      </p>

      {/* Zoomable map */}
      <div className="relative flex-1 overflow-hidden">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit
        >
          {({ resetTransform }) => (
            <>
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%' }}
              >
                <img
                  src="/venue-map.png"
                  alt={t('venueMap.title')}
                  className="block h-auto w-full"
                  draggable={false}
                />
              </TransformComponent>

              <Button
                size="sm"
                onClick={() => resetTransform()}
                className="absolute bottom-6 right-4 z-10 gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                {t('venueMap.resetZoom')}
              </Button>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
