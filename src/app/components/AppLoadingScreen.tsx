import appLogo from '@/assets/polesheadlamp-app-logo-round.png';
import { cn } from './ui/utils';

type AppLoadingScreenProps = {
  label?: string;
  detail?: string;
  inline?: boolean;
  className?: string;
};

export function AppLoadingScreen({
  label = 'Menyiapkan RHI System',
  detail = 'Memuat data, akses role, dan workspace aplikasi...',
  inline = false,
  className,
}: AppLoadingScreenProps) {
  return (
    <div className={cn(inline ? 'appLoadingInline' : 'appSplash', className)} role="status" aria-live="polite">
      <div className="appLoadingCard">
        <div className="appLoadingMark" aria-hidden="true">
          <span className="appLoadingOrbit" />
          <span className="appLoadingGlow" />
          <img src={appLogo} alt="" />
        </div>
        <div className="appLoadingCopy">
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
        <div className="appLoadingDots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
