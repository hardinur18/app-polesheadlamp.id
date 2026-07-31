import * as React from 'react';
import { ImageIcon } from 'lucide-react';
import { getPlatformLogoPublicUrl } from '@/app/services/platformLogoService';
import { cn } from './utils';

type PlatformLogoProps = {
  className?: string;
  logoPath?: string | null;
  name: string;
  density?: 'default' | 'compact';
  size?: 'sm' | 'md';
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PL';
}

function normalizePlatformName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getDefaultPlatformLogo(name: string) {
  const normalized = normalizePlatformName(name);

  if (normalized.includes('meta') || normalized.includes('facebook')) {
    return '/platform-logos/meta.png';
  }

  if (normalized.includes('tiktok')) {
    return '/platform-logos/tiktok.webp';
  }

  if (normalized.includes('google')) {
    return '/platform-logos/google.png';
  }

  if (normalized.includes('snack')) {
    return '/platform-logos/snackvideo.webp';
  }

  return '';
}

export function PlatformLogo({ className, density = 'default', logoPath, name, size = 'md' }: PlatformLogoProps) {
  const [failed, setFailed] = React.useState(false);
  const src = !failed ? getPlatformLogoPublicUrl(logoPath) || getDefaultPlatformLogo(name) : '';

  return (
    <span className={cn('platformLogo', size === 'sm' && 'isSm', density === 'compact' && 'isCompact', className)}>
      {src ? (
        <img src={src} alt={`${name} logo`} loading="lazy" onError={() => setFailed(true)} />
      ) : name ? (
        <span>{getInitials(name)}</span>
      ) : (
        <ImageIcon />
      )}
    </span>
  );
}
