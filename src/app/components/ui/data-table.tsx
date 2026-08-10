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
  columns?: DataTableColumn[];
  minWidth?: number | string;
  primaryLines?: number;
  rowMinHeight?: number | string;
  secondaryLines?: number;
  textMax?: number | string;
};

export type DataTableColumnPreset =
  | 'action'
  | 'checkbox'
  | 'compact'
  | 'date'
  | 'description'
  | 'money'
  | 'name'
  | 'number'
  | 'quantity'
  | 'status'
  | 'text'
  | 'wide';

export type DataTableColumnAlign = 'center' | 'left' | 'right';

export type DataTableColumnConfig = {
  align?: DataTableColumnAlign;
  className?: string;
  minWidth?: number;
  preset?: DataTableColumnPreset;
  width?: number | string;
};

export type DataTableColumn =
  | DataTableColumnConfig
  | DataTableColumnPreset
  | false
  | null
  | number
  | string
  | undefined;

type ResolvedDataTableColumn = {
  align?: DataTableColumnAlign;
  className?: string;
  minWidth: number;
  preset?: DataTableColumnPreset;
  width: string;
};

const DATA_TABLE_COLUMN_PRESETS: Record<DataTableColumnPreset, Pick<ResolvedDataTableColumn, 'align' | 'minWidth' | 'width'>> = {
  action: { align: 'center', minWidth: 82, width: '82px' },
  checkbox: { align: 'center', minWidth: 56, width: '56px' },
  compact: { align: 'center', minWidth: 112, width: 'clamp(104px, 8vw, 132px)' },
  date: { align: 'left', minWidth: 136, width: 'clamp(136px, 10vw, 164px)' },
  description: { align: 'left', minWidth: 280, width: 'clamp(280px, 22vw, 380px)' },
  money: { align: 'right', minWidth: 148, width: 'clamp(148px, 10vw, 176px)' },
  name: { align: 'left', minWidth: 240, width: 'clamp(240px, 18vw, 340px)' },
  number: { align: 'center', minWidth: 64, width: '64px' },
  quantity: { align: 'center', minWidth: 104, width: 'clamp(96px, 7vw, 120px)' },
  status: { align: 'center', minWidth: 132, width: 'clamp(124px, 9vw, 152px)' },
  text: { align: 'left', minWidth: 190, width: 'clamp(190px, 14vw, 260px)' },
  wide: { align: 'left', minWidth: 320, width: 'clamp(300px, 24vw, 420px)' },
};

function toCssLength(value: number | string | undefined) {
  if (typeof value === 'number') return `${value}px`;
  return value;
}

function toCssCount(value: number | undefined) {
  if (typeof value !== 'number') return undefined;
  return String(Math.max(1, Math.floor(value)));
}

function isColumnPreset(value: string): value is DataTableColumnPreset {
  return value in DATA_TABLE_COLUMN_PRESETS;
}

function resolveDataTableColumn(column: DataTableColumn): ResolvedDataTableColumn | null {
  if (column === false || column === null || column === undefined) return null;

  if (typeof column === 'number') {
    return { minWidth: column, width: `${column}px` };
  }

  if (typeof column === 'string') {
    if (isColumnPreset(column)) {
      return { preset: column, ...DATA_TABLE_COLUMN_PRESETS[column] };
    }

    return { minWidth: 120, width: column };
  }

  const preset = column.preset;
  const presetConfig = preset ? DATA_TABLE_COLUMN_PRESETS[preset] : undefined;
  const width = toCssLength(column.width) || presetConfig?.width || DATA_TABLE_COLUMN_PRESETS.text.width;
  const minWidth = column.minWidth || presetConfig?.minWidth || 120;

  return {
    align: column.align || presetConfig?.align,
    className: column.className,
    minWidth,
    preset,
    width,
  };
}

export function createDataTableColumns(columns: DataTableColumn[]) {
  return columns;
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
    const resolvedColumn = resolveDataTableColumn(column);
    return resolvedColumn ? [resolvedColumn] : [];
  });

  if (resolvedActionWidth) cssVars['--table-action-width'] = resolvedActionWidth;
  if (resolvedCellX) cssVars['--table-cell-x'] = resolvedCellX;
  if (resolvedCellY) cssVars['--table-cell-y'] = resolvedCellY;
  if (resolvedMinWidth) {
    cssVars['--table-min-width'] = resolvedMinWidth;
  } else if (resolvedColumns?.length) {
    cssVars['--table-min-width'] = `${resolvedColumns.reduce((total, column) => total + column.minWidth, 0)}px`;
  }
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
      {resolvedColumns?.length ? injectTableColumns(children, resolvedColumns) : children}
    </div>
  );
}

function injectTableColumns(children: ReactNode, columns: ResolvedDataTableColumn[]) {
  const columnGroup = (
    <colgroup>
      {columns.map((column, index) => (
        <col key={`${column.width}-${index}`} style={{ width: column.width }} />
      ))}
    </colgroup>
  );

  return React.Children.map(children, (child) => {
    if (!React.isValidElement<{ children?: ReactNode }>(child)) {
      return child;
    }

    const elementName = getElementName(child);

    if (!['Table', 'table'].includes(elementName)) {
      return child;
    }

    const tableChildren = React.Children.toArray(child.props.children).filter((tableChild) => {
      return !(React.isValidElement(tableChild) && getElementName(tableChild) === 'colgroup');
    });

    return React.cloneElement(
      child,
      undefined,
      columnGroup,
      ...tableChildren.map((tableChild) => injectColumnClasses(tableChild, columns)),
    );
  });
}

function injectColumnClasses(child: ReactNode, columns: ResolvedDataTableColumn[]): ReactNode {
  if (!React.isValidElement<{ children?: ReactNode; className?: string }>(child)) return child;
  const elementName = getElementName(child);

  if (['TableBody', 'TableFooter', 'TableHeader', 'tbody', 'tfoot', 'thead'].includes(elementName)) {
    return React.cloneElement(
      child,
      undefined,
      React.Children.map(child.props.children, (sectionChild) => injectColumnClasses(sectionChild, columns)),
    );
  }

  if (!['TableRow', 'tr'].includes(elementName)) return child;

  let columnIndex = 0;
  const rowChildren = React.Children.map(child.props.children, (cell) => {
    if (!React.isValidElement<{ className?: string }>(cell)) return cell;

    const column = columns[columnIndex];
    columnIndex += 1;

    if (!column) return cell;

    return React.cloneElement(cell, {
      className: cn(cell.props.className, getDataTableColumnClassName(column)),
    });
  });

  return React.cloneElement(child, undefined, rowChildren);
}

function getElementName(element: React.ReactElement) {
  if (typeof element.type === 'string') return element.type;
  if (typeof element.type !== 'function' && (typeof element.type !== 'object' || element.type === null)) return '';

  const elementType = element.type as { displayName?: string; name?: string };
  if (typeof elementType.displayName === 'string') return elementType.displayName;
  if (typeof elementType.name === 'string') return elementType.name;
  return '';
}

function getDataTableColumnClassName(column: ResolvedDataTableColumn) {
  return cn(
    'dataTableColumn',
    column.preset && `dataTableColumn--${column.preset}`,
    column.align && `dataTableColumn--align-${column.align}`,
    column.className,
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
