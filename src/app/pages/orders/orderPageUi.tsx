import React from 'react';
import {
  TableCell,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui/tooltip';

export const ORDER_ACTION_ICON_CLASS =
  'relative h-8 w-8 rounded-md bg-transparent p-0 text-slate-500 shadow-none transition-colors hover:bg-transparent hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-400 dark:hover:text-slate-100';

export const ORDER_MENU_CONTENT_CLASS =
  'w-56 border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800';

export const ORDER_MENU_ITEM_CLASS = 'cursor-pointer gap-2 text-sm';

export function OrderActionButton({
  label,
  className = '',
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className={`${ORDER_ACTION_ICON_CLASS} ${className}`.trim()}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function OrderTableSkeleton({
  columns,
  rows = 8,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`order-table-skeleton-${rowIndex}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={`order-table-skeleton-${rowIndex}-${columnIndex}`} className="py-6 align-top">
              <Skeleton
                className={
                  columnIndex === 0
                    ? 'mx-auto h-4 w-8 rounded-md'
                    : columnIndex === 4
                      ? 'h-12 w-full max-w-[260px] rounded-md'
                      : 'h-4 w-full max-w-[160px] rounded-md'
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function OrderMobileSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`order-mobile-skeleton-${index}`}
          className="orderMobileCard rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="mt-4 h-4 w-40 rounded-md" />
          <Skeleton className="mt-3 h-3 w-full rounded-md" />
          <Skeleton className="mt-2 h-3 w-2/3 rounded-md" />
        </div>
      ))}
    </>
  );
}
