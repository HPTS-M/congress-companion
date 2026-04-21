import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import i18n from '@/lib/i18n';

interface ErrorFallbackProps {
  resetError?: () => void;
  eventId?: string | null;
}

const STORAGE_KEY = 'errorReloadAttempts';
const ATTEMPTS_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 2;
const COUNTDOWN_SECONDS = 5;

// Emergency fallback texts (Spanish) used if i18n hasn't initialized yet.
const FALLBACK_ES = {
  title: 'Algo no salió como esperábamos',
  message:
    'No te preocupes, esto suele resolverse al refrescar. Tu sesión y tus datos están seguros.',
  autoRetry: 'Reintentando automáticamente en {{seconds}} s…',
  offlineWaiting: 'Esperando conexión a internet…',
  maxAttemptsReached:
    'Si el problema continúa, intenta más tarde o contacta al organizador.',
  refreshNow: 'Refrescar ahora',
  goHome: 'Volver al inicio',
  errorId: 'ID del error: {{id}}',
  copyId: 'Copiar ID',
  idCopied: 'ID copiado',
};

function readAttempts(): { count: number; firstAt: number } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, firstAt: 0 };
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.firstAt > ATTEMPTS_WINDOW_MS) {
      return { count: 0, firstAt: 0 };
    }
    return parsed;
  } catch {
    return { count: 0, firstAt: 0 };
  }
}

function writeAttempt() {
  try {
    const current = readAttempts();
    const next =
      current.count === 0
        ? { count: 1, firstAt: Date.now() }
        : { count: current.count + 1, firstAt: current.firstAt };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function ErrorFallback({ eventId }: ErrorFallbackProps) {
  const i18nReady = i18n.isInitialized;
  const { t } = useTranslation('common');

  const tr = (key: keyof typeof FALLBACK_ES, opts?: Record<string, unknown>): string => {
    if (i18nReady) {
      return t(`errorFallback.${key}`, { defaultValue: FALLBACK_ES[key], ...opts });
    }
    let txt: string = FALLBACK_ES[key];
    if (opts) {
      for (const [k, v] of Object.entries(opts)) {
        txt = txt.replace(`{{${k}}}`, String(v));
      }
    }
    return txt;
  };

  const attemptsAtMount = useRef(readAttempts());
  const exceeded = attemptsAtMount.current.count >= MAX_ATTEMPTS;

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [seconds, setSeconds] = useState<number>(COUNTDOWN_SECONDS);
  const [copied, setCopied] = useState(false);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action for accessibility
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  // Track online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-reload countdown (only if attempts not exceeded AND online)
  useEffect(() => {
    if (exceeded) return;
    if (!isOnline) return;

    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          writeAttempt();
          window.location.reload();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [exceeded, isOnline]);

  // Reset countdown when coming back online
  useEffect(() => {
    if (isOnline && !exceeded) {
      setSeconds(COUNTDOWN_SECONDS);
    }
  }, [isOnline, exceeded]);

  const handleRefresh = () => {
    writeAttempt();
    window.location.reload();
  };

  const handleGoHome = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.location.href = '/';
  };

  const handleCopyId = async () => {
    if (!eventId) return;
    try {
      await navigator.clipboard.writeText(eventId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8"
    >
      <div className="w-full max-w-[400px] bg-card text-card-foreground rounded-2xl shadow-lg border border-border p-6 flex flex-col items-center text-center">
        {/* Brand logo */}
        <img
          src="/logo-acqfh-v2.jpg"
          alt="CONGRÉSSAPP"
          className="h-12 w-auto mb-6 rounded"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-accent" aria-hidden="true" />
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold mb-2">{tr('title')}</h1>

        {/* Message */}
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          {tr('message')}
        </p>

        {/* Status line: countdown / offline / max attempts */}
        <div className="w-full mb-5 min-h-[40px] flex items-center justify-center">
          {exceeded ? (
            <p className="text-xs text-muted-foreground">{tr('maxAttemptsReached')}</p>
          ) : !isOnline ? (
            <p className="text-sm text-primary font-medium">{tr('offlineWaiting')}</p>
          ) : (
            <p className="text-sm text-primary font-medium" aria-live="polite">
              {tr('autoRetry', { seconds })}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2">
          <Button
            ref={primaryBtnRef}
            onClick={handleRefresh}
            className="w-full"
            size="lg"
          >
            <RefreshCw className="w-4 h-4" />
            {tr('refreshNow')}
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Home className="w-4 h-4" />
            {tr('goHome')}
          </Button>
        </div>

        {/* Error ID footer */}
        {eventId && (
          <div className="mt-6 pt-4 border-t border-border w-full flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="truncate max-w-[200px]">
              {tr('errorId', { id: eventId.slice(0, 8) })}
            </span>
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              aria-label={tr('copyId')}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>{tr('idCopied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{tr('copyId')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ErrorFallback;
