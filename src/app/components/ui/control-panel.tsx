import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from './utils';

type ControlPanelProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function ControlPanel({ children, className, ...props }: ControlPanelProps) {
  return (
    <section className={cn('controlPanel', className)} {...props}>
      {children}
    </section>
  );
}

export function ControlRow({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('controlRow', className)} {...props}>
      {children}
    </div>
  );
}

type SearchBoxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  icon?: React.ReactNode;
  wrapperClassName?: string;
};

export const SearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ className, icon, wrapperClassName, ...props }, ref) => (
    <label className={cn('searchBox', wrapperClassName)}>
      {icon ?? <Search className="h-4 w-4" />}
      <input ref={ref} className={className} {...props} />
    </label>
  ),
);
SearchBox.displayName = 'SearchBox';

type FilterFieldProps = React.HTMLAttributes<HTMLLabelElement> & {
  label: React.ReactNode;
  children: React.ReactNode;
};

export function FilterField({ label, children, className, ...props }: FilterFieldProps) {
  return (
    <label className={cn('filterField', className)} {...props}>
      <span className="filterFieldLabel">{label}</span>
      {children}
    </label>
  );
}

