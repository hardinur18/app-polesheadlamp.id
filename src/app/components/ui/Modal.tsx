import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './utils';

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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
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
        'appModalLayer fixed inset-0 z-[100] flex items-center justify-center',
        scope === 'workspace' && 'workspaceModalLayer',
      )}
    >
      {/* Backdrop */}
      <div
        className="appModalBackdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={preventOutsideClose ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className={`appModalPanel relative w-full ${sizeClasses[size]} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col transition-colors my-auto mx-4 ${className}`}>
        {/* Header */}
        {title && (
          <div className="appModalHeader flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500 dark:text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="appModalBody flex-1 overflow-y-auto p-4 sm:p-6 text-slate-900 dark:text-slate-300">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="appModalFooter p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
