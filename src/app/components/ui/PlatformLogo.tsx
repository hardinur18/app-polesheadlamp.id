import { cn } from '@/app/components/ui/utils';
import googleLogo from '@/marketing-os/assets/platforms/google.png';
import metaLogo from '@/marketing-os/assets/platforms/meta.png';
import tiktokLogo from '@/marketing-os/assets/platforms/tiktok.webp';

type SupportedPlatform = 'meta' | 'google' | 'tiktok' | 'instagram' | 'facebook_page' | 'whatsapp' | string;

type PlatformLogoProps = {
  platform: SupportedPlatform;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  labelClassName?: string;
};

const sizeClassMap = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
} as const;

const platformLabelMap: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook_page: 'Messenger',
  whatsapp: 'WhatsApp',
};

const platformLogoMap: Record<string, string> = {
  meta: metaLogo,
  google: googleLogo,
  tiktok: tiktokLogo,
};

function renderPlatformSvg(platform: SupportedPlatform) {
  const logoSrc = platformLogoMap[String(platform)];

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt=""
        aria-hidden
        className="h-full w-full object-contain"
        draggable={false}
      />
    );
  }

  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
      {(platformLabelMap[String(platform)] || String(platform)).slice(0, 2)}
    </span>
  );
}

export function PlatformLogo({
  platform,
  size = 'md',
  showLabel = false,
  className,
  labelClassName,
}: PlatformLogoProps) {
  const label = platformLabelMap[String(platform)] || String(platform);

  return (
    <span
      className={cn('inline-flex items-center gap-2 align-middle', className)}
      title={label}
      aria-label={label}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
          platform === 'meta' && 'bg-blue-50 dark:bg-blue-950/30',
          platform === 'google' && 'bg-white dark:bg-slate-900',
          platform === 'tiktok' && 'bg-slate-100 dark:bg-slate-800',
          sizeClassMap[size],
        )}
      >
        {renderPlatformSvg(platform)}
      </span>
      {showLabel ? (
        <span className={cn('truncate text-sm font-medium text-slate-700 dark:text-slate-200', labelClassName)}>
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
