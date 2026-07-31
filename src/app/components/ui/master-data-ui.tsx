import * as React from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { Button } from './button';
import { DialogFooter } from './dialog';
import { TableActionMenu, TableActionMenuItem } from './data-table';
import { cn } from './utils';

type MasterDataFormActionsProps = {
  cancelLabel?: ReactNode;
  className?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  saveLabel?: ReactNode;
  submitDisabled?: boolean;
};

export function MasterDataFormActions({
  cancelLabel = 'Batal',
  className,
  isSubmitting,
  onCancel,
  saveLabel = 'Simpan',
  submitDisabled,
}: MasterDataFormActionsProps) {
  return (
    <DialogFooter className={cn('masterDataFormActions', className)}>
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        icon={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        disabled={isSubmitting || submitDisabled}
      >
        {saveLabel}
      </Button>
    </DialogFooter>
  );
}

type MasterDataDialogShellProps = React.HTMLAttributes<HTMLDivElement> & {
  compact?: boolean;
};

export function MasterDataDialogBody({
  children,
  className,
  compact,
  ...props
}: MasterDataDialogShellProps) {
  return (
    <div className={cn('masterDataDialogBody', compact && 'isCompact', className)} {...props}>
      {children}
    </div>
  );
}

type MasterDataConfirmContentProps = {
  actionLabel?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  onConfirm: () => void;
  title: ReactNode;
  tone?: 'danger' | 'default';
};

export function MasterDataConfirmContent({
  actionLabel = 'Hapus',
  children,
  disabled,
  onConfirm,
  title,
  tone = 'danger',
}: MasterDataConfirmContentProps) {
  return (
    <AlertDialogContent className="masterDataConfirmDialog">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {children ? <AlertDialogDescription>{children}</AlertDialogDescription> : null}
      </AlertDialogHeader>
      <AlertDialogFooter className="masterDataConfirmActions">
        <AlertDialogCancel asChild disabled={disabled}>
          <Button type="button" variant="outline">Batal</Button>
        </AlertDialogCancel>
        <Button
          type="button"
          variant={tone === 'danger' ? 'danger' : 'primary'}
          icon={tone === 'danger' ? <Trash2 className="h-4 w-4" /> : undefined}
          onClick={onConfirm}
          disabled={disabled}
        >
          {actionLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

type MobileCardAction = {
  danger?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  label: ReactNode;
  onClick: () => void;
};

type MobileCardActionsProps = {
  actions: MobileCardAction[];
  className?: string;
};

export function MobileCardActions({ actions, className }: MobileCardActionsProps) {
  const visibleActions = actions.filter(Boolean);
  if (visibleActions.length === 0) return null;

  return (
    <div className={cn('mobileCardActions', className)} onClick={(event) => event.stopPropagation()}>
      <TableActionMenu contentClassName="w-48">
        {visibleActions.map((action, index) => (
          <TableActionMenuItem
            key={index}
            danger={action.danger}
            disabled={action.disabled}
            icon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </TableActionMenuItem>
        ))}
      </TableActionMenu>
    </div>
  );
}
