import React from 'react';
import { Building2 } from 'lucide-react';
import { getBankLogoPublicUrl } from '@/app/services/bankLogoService';
import { cn } from './utils';

type BankLogoProps = {
  className?: string;
  density?: 'compact' | 'default';
  logoPath?: string | null;
  name: string;
  size?: 'sm' | 'md';
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'BK';
}

export function BankLogo({ className, density = 'default', logoPath, name, size = 'md' }: BankLogoProps) {
  const [failed, setFailed] = React.useState(false);
  const src = !failed ? getBankLogoPublicUrl(logoPath) : '';

  React.useEffect(() => {
    setFailed(false);
  }, [logoPath]);

  return (
    <span
      className={cn(
        'platformLogo',
        density === 'compact' && 'isCompact',
        size === 'sm' && 'isSmall',
        className,
      )}
      title={name}
    >
      {src ? (
        <img
          alt={`${name} logo`}
          src={src}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="platformLogoFallback">
          {name ? getInitials(name) : <Building2 />}
        </span>
      )}
    </span>
  );
}
