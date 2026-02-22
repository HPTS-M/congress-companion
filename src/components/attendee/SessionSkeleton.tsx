import { Skeleton } from '@/components/ui/skeleton';

export function SessionSkeleton() {
  return (
    <div className="space-y-3 px-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
