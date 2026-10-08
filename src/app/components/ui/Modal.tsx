import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './utils';

let bodyScrollLockCount = 0;
let bodyPreviousOverflow: string | null = null;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  preventOutsideClose?: boolean;
  className?: string;
  scope?: 'viewport' | 'workspace';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  preventOutsideClose = false,
  className = '',
  scope = 'viewport',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined;
    }

    if (bodyScrollLockCount === 0) {
      bodyPreviousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    bodyScrollLockCount += 1;

    return () => {
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = bodyPreviousOverflow ?? '';
        bodyPreviousOverflow = null;
      }
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-7xl mx-4',
  };
  
  const modal = (
    <div
      className={cn(
        'appModalLayer fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain p-3 sm:p-4',
        scope === 'workspace' && 'workspaceModalLayer',
      )}
    >
      {/* Backdrop */}
      <div
        className="appModalBackdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={preventOutsideClose ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className={`appModalPanel relative w-full ${sizeClasses[size]} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[calc(100dvh-24px)] sm:max-h-[90dvh] min-h-0 overflow-hidden flex flex-col transition-colors my-auto ${className}`}>
        {/* Header */}
        {title && (
          <div className="appModalHeader flex shrink-0 items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500 dark:text-slate-400"
              aria-label="Tutup modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="appModalBody flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 text-slate-900 dark:text-slate-300">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="appModalFooter shrink-0 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
