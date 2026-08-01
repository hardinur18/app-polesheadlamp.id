import * as React from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleHelp, Loader2, Save, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { Button } from './button';
import { DialogContent, DialogFooter } from './dialog';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { TableActionMenu, TableActionMenuItem } from './data-table';
import { cn } from './utils';

type MasterDataFormActionsProps = {
  cancelLabel?: ReactNode;
  className?: string;
  confirmOnCancel?: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  saveLabel?: ReactNode;
  submitDisabled?: boolean;
};

export function MasterDataFormActions({
  cancelLabel = 'Batal',
  className,
  confirmOnCancel: _confirmOnCancel,
  isSubmitting,
  onCancel,
  saveLabel = 'Simpan',
  submitDisabled,
}: MasterDataFormActionsProps) {
  const handleCancel = () => {
    onCancel();
  };

  return (
    <DialogFooter className={cn('masterDataFormActions', className)}>
      <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
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

type MasterDataFormCloseGuardProps = {
  hasUnsavedChanges: boolean;
  onClose: () => void;
};

export function useMasterDataFormCloseGuard({
  hasUnsavedChanges,
  onClose,
}: MasterDataFormCloseGuardProps) {
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  const requestClose = React.useCallback(() => {
    if (hasUnsavedChanges) {
      setIsConfirmOpen(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  const confirmClose = React.useCallback(() => {
    setIsConfirmOpen(false);
    onClose();
  }, [onClose]);

  const cancelClose = React.useCallback(() => {
    setIsConfirmOpen(false);
  }, []);

  return {
    cancelClose,
    confirmClose,
    isConfirmOpen,
    requestClose,
  };
}

type MasterDataUnsavedChangesDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
};

export function MasterDataUnsavedChangesDialog({
  onCancel,
  onConfirm,
  open,
}: MasterDataUnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onCancel();
    }}>
      <AlertDialogContent className="max-w-md rounded-2xl border-none bg-white shadow-2xl dark:bg-slate-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Buang perubahan?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            Form sudah berisi perubahan. Jika ditutup sekarang, perubahan yang belum disimpan akan hilang.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" onClick={onCancel}>
              Tetap Edit
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant="danger" onClick={onConfirm}>
              Buang Perubahan
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

type MasterDataFormDialogContentProps = React.ComponentProps<typeof DialogContent> & {
  preventOutsideClose?: boolean;
  size?: 'default' | 'wide';
};

export function MasterDataFormDialogContent({
  children,
  className,
  preventOutsideClose = true,
  size = 'default',
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: MasterDataFormDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        'max-h-[88vh] overflow-y-auto rounded-2xl border-none bg-white shadow-2xl dark:bg-slate-900',
        size === 'wide' ? 'sm:max-w-[760px]' : 'sm:max-w-[520px]',
        className,
      )}
      onEscapeKeyDown={(event) => {
        if (preventOutsideClose) event.preventDefault();
        onEscapeKeyDown?.(event);
      }}
      onPointerDownOutside={(event) => {
        if (preventOutsideClose) event.preventDefault();
        onPointerDownOutside?.(event);
      }}
      onInteractOutside={(event) => {
        if (preventOutsideClose) event.preventDefault();
        onInteractOutside?.(event);
      }}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export type MasterDataFieldInfo = {
  title: string;
  description: string;
};

type MasterDataFieldLabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  info?: MasterDataFieldInfo;
  onInfo?: (info: MasterDataFieldInfo) => void;
  required?: boolean;
};

export function MasterDataFieldLabel({
  children,
  className,
  info,
  onInfo,
  required,
  ...props
}: MasterDataFieldLabelProps) {
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => {
      setIsInfoOpen(false);
      closeTimer.current = null;
    }, 120);
  }, [cancelScheduledClose]);

  React.useEffect(() => cancelScheduledClose, [cancelScheduledClose]);

  return (
    <label
      className={cn('flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300', className)}
      {...props}
    >
      <span>
        {children}{required && <span className="text-red-500"> *</span>}
      </span>
      {info ? (
        <Popover open={isInfoOpen} onOpenChange={setIsInfoOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:hover:bg-slate-800"
              aria-label={`Info ${info.title}`}
              onClick={() => {
                onInfo?.(info);
                setIsInfoOpen((value) => !value);
              }}
              onMouseEnter={() => {
                cancelScheduledClose();
                setIsInfoOpen(true);
              }}
              onMouseLeave={scheduleClose}
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={scheduleClose}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                <CircleHelp className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">{info.title}</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                  {info.description}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Tutup informasi"
                onClick={() => setIsInfoOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </label>
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
