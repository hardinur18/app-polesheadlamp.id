import * as React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CheckCircle2, Clock, MoreVertical, XCircle, type LucideIcon } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { cn } from './utils';

type DataTableProps = React.HTMLAttributes<HTMLDivElement> & {
  actionWidth?: number | string;
  cellX?: number | string;
  cellY?: number | string;
  columns?: Array<number | string | false | null | undefined>;
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
  columns,
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
  const resolvedColumns = columns?.flatMap((column) => {
    if (column === false || column === null || column === undefined) return [];
    const width = toCssLength(column);
    return width ? [width] : [];
  });

  if (resolvedActionWidth) cssVars['--table-action-width'] = resolvedActionWidth;
  if (resolvedCellX) cssVars['--table-cell-x'] = resolvedCellX;
  if (resolvedCellY) cssVars['--table-cell-y'] = resolvedCellY;
  if (resolvedMinWidth) cssVars['--table-min-width'] = resolvedMinWidth;
  if (resolvedRowMinHeight) cssVars['--table-row-min-h'] = resolvedRowMinHeight;
  if (resolvedPrimaryLines) cssVars['--table-primary-lines'] = resolvedPrimaryLines;
  if (resolvedSecondaryLines) cssVars['--table-secondary-lines'] = resolvedSecondaryLines;
  if (resolvedTextMax) cssVars['--table-text-max'] = resolvedTextMax;

  return (
    <div
      className={cn('tableScroller uiDataTableScroller', resolvedColumns?.length && 'uiDataTableHasColumns', className)}
      style={cssVars}
      {...props}
    >
      {resolvedColumns?.length ? injectColumnGroup(children, resolvedColumns) : children}
    </div>
  );
}

function injectColumnGroup(children: ReactNode, columns: string[]) {
  const columnGroup = (
    <colgroup>
      {columns.map((width, index) => (
        <col key={`${width}-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );

  return React.Children.map(children, (child) => {
    if (!React.isValidElement<{ children?: ReactNode }>(child) || child.type !== 'table') {
      return child;
    }

    const tableChildren = React.Children.toArray(child.props.children).filter((tableChild) => {
      return !(React.isValidElement(tableChild) && tableChild.type === 'colgroup');
    });

    return React.cloneElement(child, undefined, columnGroup, ...tableChildren);
  });
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
    <div className={cn('tableTextStack', className)} data-full-text={title || fallbackTitle || undefined}>
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

export function TableStatusCell({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('tableStatusCell', className)} {...props}>
      {children}
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

type TableActionMenuProps = {
  align?: React.ComponentProps<typeof DropdownMenuContent>['align'];
  children: ReactNode;
  contentClassName?: string;
  sideOffset?: React.ComponentProps<typeof DropdownMenuContent>['sideOffset'];
  trigger?: ReactNode;
};

export function TableActionMenu({
  align = 'end',
  children,
  contentClassName,
  sideOffset = 8,
  trigger,
}: TableActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || <TableActionMenuTrigger />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={sideOffset} className={cn('appDropdownPanel w-44', contentClassName)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TableActionMenuItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuItem> & {
  danger?: boolean;
  icon?: LucideIcon;
};

export function TableActionMenuItem({
  children,
  className,
  danger,
  icon: Icon,
  ...props
}: TableActionMenuItemProps) {
  return (
    <DropdownMenuItem
      className={cn('appDropdownItem cursor-pointer', danger && 'danger', className)}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </DropdownMenuItem>
  );
}

type TableCellIconProps = React.HTMLAttributes<HTMLSpanElement> & {
  icon: LucideIcon;
};

export function TableCellIcon({ className, icon: Icon, ...props }: TableCellIconProps) {
  return (
    <span className={cn('dataTableCellIcon', className)} {...props}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

type TableStatusIconProps = React.HTMLAttributes<HTMLSpanElement> & {
  label?: string;
  tone?: 'active' | 'inactive' | 'soon' | 'neutral';
};

export function TableStatusIcon({
  className,
  label,
  tone = 'neutral',
  ...props
}: TableStatusIconProps) {
  const Icon = tone === 'active' ? CheckCircle2 : tone === 'soon' ? Clock : tone === 'inactive' ? XCircle : Clock;
  const fallbackLabel = tone === 'active' ? 'Aktif' : tone === 'soon' ? 'Coming soon' : tone === 'inactive' ? 'Non aktif' : 'Status';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'dataStatusIcon',
            tone === 'active' && 'isActive',
            tone === 'soon' && 'isSoon',
            tone === 'inactive' && 'isInactive',
            className,
          )}
          aria-label={label || fallbackLabel}
          {...props}
        >
          <Icon />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label || fallbackLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}

type TableStatusSwitchProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked: boolean;
  loading?: boolean;
  offLabel?: string;
  onLabel?: string;
};

export function TableStatusSwitch({
  checked,
  className,
  disabled,
  loading,
  offLabel = 'OFF',
  onLabel = 'ON',
  ...props
}: TableStatusSwitchProps) {
  const label = loading ? 'Sync' : checked ? onLabel : offLabel;

  return (
    <button
      type="button"
      aria-checked={checked}
      aria-label={checked ? onLabel : offLabel}
      className={cn(
        'dataStatusSwitch',
        checked ? 'isOn' : 'isOff',
        loading && 'isLoading',
        className,
      )}
      disabled={disabled || loading}
      role="switch"
      {...props}
    >
      <span className="dataStatusSwitchTrack">
        <span className="dataStatusSwitchThumb" />
      </span>
      <span className="dataStatusSwitchLabel">{label}</span>
    </button>
  );
}
