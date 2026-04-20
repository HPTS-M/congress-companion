import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Copy, Star, Users, Trash2, Archive, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import type { EventActivity } from '@/types';
import { getSessionStatus, STATUS_DOT_CLASS } from '@/lib/session-status';

interface Props {
  session: EventActivity;
  typeColor: string;
  interests: number;
  checkins: number;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function SortableSessionRow({
  session,
  typeColor,
  interests,
  checkins,
  onClick,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: Props) {
  const { t } = useTranslation('admin');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: `4px solid ${typeColor}`,
  };

  const status = getSessionStatus(session);
  const statusLabel = t(`agenda.status.${status}`);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-center gap-2 rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer animate-fade-in"
      onClick={onClick}
    >
      {/* Status dot — top-right */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`absolute right-2 top-2 h-2 w-2 rounded-full ${STATUS_DOT_CLASS[status]}`}
            aria-label={statusLabel}
          />
        </TooltipTrigger>
        <TooltipContent>{statusLabel}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="touch-none p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
            aria-label={t('agenda.actions.reorder')}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('agenda.actions.reorder')}</TooltipContent>
      </Tooltip>

      <div className="min-w-[60px] sm:min-w-[70px] text-sm">
        <p className="font-bold text-foreground">{session.start_time?.slice(0, 5)}</p>
        <p className="text-muted-foreground text-xs hidden sm:block">{session.end_time?.slice(0, 5)}</p>
      </div>

      <div className="flex-1 min-w-0 pr-3">
        <p className="font-semibold text-sm text-foreground truncate">{session.title}</p>
        <div className="hidden sm:flex flex-wrap items-center gap-2 mt-1">
          {session.location && (
            <Badge variant="secondary" className="text-xs">{session.location}</Badge>
          )}
          {session.speaker_name && (
            <span className="text-xs text-muted-foreground">{session.speaker_name}</span>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          {interests}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-[hsl(168,76%,36%)]" />
          {checkins}
        </span>
      </div>

      {/* Desktop actions */}
      <div className="hidden sm:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('agenda.actions.edit')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('agenda.actions.duplicate')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('agenda.actions.archive')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('agenda.actions.delete')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Mobile actions — single gear menu */}
      <div className="flex sm:hidden" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label={t('agenda.actions.menu')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('agenda.actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              {t('agenda.actions.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="text-amber-600">
              <Archive className="mr-2 h-4 w-4" />
              {t('agenda.actions.archive')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              {t('agenda.actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
