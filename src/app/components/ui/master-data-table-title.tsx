import * as React from 'react';
import { CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import { Badge } from './badge';
import { cn } from './utils';

type MasterDataTableTitleProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  count?: React.ReactNode;
  variant?: 'active' | 'inactive' | 'default';
  icon?: LucideIcon;
};

export function MasterDataTableTitle({
  title,
  count,
  variant = 'default',
  icon,
  className,
  ...props
}: MasterDataTableTitleProps) {
  const Icon = icon ?? (variant === 'inactive' ? XCircle : CheckCircle2);

  return (
    <div className={cn('masterDataListHeader', className)} {...props}>
      <div className={cn('masterDataListIcon', variant === 'inactive' && 'isInactive')}>
        <Icon />
      </div>
      <h3>{title}</h3>
      {count !== undefined && (
        <Badge variant="secondary" className="masterDataListCount">
          {count}
        </Badge>
      )}
    </div>
  );
}
