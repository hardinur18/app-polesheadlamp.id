import * as React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

type DataTableProps = React.HTMLAttributes<HTMLDivElement> & {
  actionWidth?: number | string;
  cellX?: number | string;
  cellY?: number | string;
  minWidth?: number | string;
  primaryLines?: number;
  rowMinHeight?: number | string;
  secondaryLines?: number;
  textMax?: number | string;
};

function toCssLength(value: number | string | undefined) {
  if (typeof value === 'number') return `${value}px`;
  return value;
}

function toCssCount(value: number | undefined) {
  if (typeof value !== 'number') return undefined;
  return String(Math.max(1, Math.floor(value)));
}

export function DataTable({
  actionWidth,
  cellX,
  cellY,
  children,
  className,
  minWidth,
  primaryLines,
  rowMinHeight,
  secondaryLines,
  style,
  textMax,
  ...props
}: DataTableProps) {
  const cssVars = { ...style } as CSSProperties & Record<string, string>;
  const resolvedActionWidth = toCssLength(actionWidth);
  const resolvedCellX = toCssLength(cellX);
  const resolvedCellY = toCssLength(cellY);
  const resolvedMinWidth = toCssLength(minWidth);
  const resolvedRowMinHeight = toCssLength(rowMinHeight);
  const resolvedPrimaryLines = toCssCount(primaryLines);
  const resolvedSecondaryLines = toCssCount(secondaryLines);
  const resolvedTextMax = toCssLength(textMax);

  if (resolvedActionWidth) cssVars['--table-action-width'] = resolvedActionWidth;
  if (resolvedCellX) cssVars['--table-cell-x'] = resolvedCellX;
  if (resolvedCellY) cssVars['--table-cell-y'] = resolvedCellY;
  if (resolvedMinWidth) cssVars['--table-min-width'] = resolvedMinWidth;
  if (resolvedRowMinHeight) cssVars['--table-row-min-h'] = resolvedRowMinHeight;
  if (resolvedPrimaryLines) cssVars['--table-primary-lines'] = resolvedPrimaryLines;
  if (resolvedSecondaryLines) cssVars['--table-secondary-lines'] = resolvedSecondaryLines;
  if (resolvedTextMax) cssVars['--table-text-max'] = resolvedTextMax;

  return (
    <div className={cn('tableScroller uiDataTableScroller', className)} style={cssVars} {...props}>
      {children}
    </div>
  );
}

type TableTextProps = {
  className?: string;
  primary: ReactNode;
  primaryClassName?: string;
  secondary?: ReactNode;
  secondaryClassName?: string;
  title?: string;
};

export function TableText({
  className,
  primary,
  primaryClassName,
  secondary,
  secondaryClassName,
  title,
}: TableTextProps) {
  const fallbackTitle = [textFromNode(primary), textFromNode(secondary)].filter(Boolean).join(' - ');

  return (
    <div className={cn('tableTextStack', className)} title={title || fallbackTitle || undefined}>
      <strong className={cn('tableTextPrimary', primaryClassName)}>{hasValue(primary) ? primary : '-'}</strong>
      {hasValue(secondary) ? <small className={cn('tableTextSecondary', secondaryClassName)}>{secondary}</small> : null}
    </div>
  );
}

function textFromNode(value: ReactNode) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function hasValue(value: ReactNode) {
  return value !== undefined && value !== null && value !== false && value !== '';
}

export function TableActionHeader({
  children = 'Aksi',
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('tableActionHeader', className)} {...props}>
      {children}
    </th>
  );
}

export function TableActionCell({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('tableActionCell', className)} {...props}>
      <div className="rowActions">{children}</div>
    </td>
  );
}

export function TableActionMenuTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Aksi baris" {...props}>
      <MoreVertical className="h-4 w-4" />
    </Button>
  );
}

