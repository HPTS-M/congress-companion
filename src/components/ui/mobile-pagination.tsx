import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface MobilePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Mobile-first pagination control. Large touch targets, compact layout.
 * Renders nothing when totalPages <= 1.
 */
export function MobilePagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  className = '',
}: MobilePaginationProps) {
  const { t } = useTranslation('common');
  if (totalPages <= 1) return null;

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <div
      className={`flex items-center justify-between gap-2 mt-4 ${className}`}
      role="navigation"
      aria-label={t('pagination.label', { defaultValue: 'Pagination' })}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => canPrev && onPageChange(currentPage - 1)}
        disabled={!canPrev}
        className="h-10 px-3 flex-1 sm:flex-none"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        <span>{t('pagination.previous', { defaultValue: 'Anterior' })}</span>
      </Button>

      <div className="flex flex-col items-center text-xs text-muted-foreground px-2 shrink-0">
        <span className="font-medium text-foreground">
          {t('pagination.pageOf', {
            defaultValue: 'Página {{current}} de {{total}}',
            current: currentPage,
            total: totalPages,
          })}
        </span>
        <span className="hidden sm:inline">
          {t('pagination.totalItems', { defaultValue: '{{count}} elementos', count: totalItems })}
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => canNext && onPageChange(currentPage + 1)}
        disabled={!canNext}
        className="h-10 px-3 flex-1 sm:flex-none"
      >
        <span>{t('pagination.next', { defaultValue: 'Siguiente' })}</span>
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
