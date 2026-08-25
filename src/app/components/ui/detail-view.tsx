import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from './utils';

function hasDetailValue(value: React.ReactNode) {
  return value !== undefined && value !== null && value !== false && value !== '';
}

type FoundationDetailShellProps = React.HTMLAttributes<HTMLDivElement>;

export function FoundationDetailShell({ children, className, ...props }: FoundationDetailShellProps) {
  return (
    <div className={cn('foundationDetailShell', className)} {...props}>
      {children}
    </div>
  );
}

type FoundationDetailHeroProps = React.HTMLAttributes<HTMLDivElement> & {
  actions?: React.ReactNode;
  avatar?: React.ReactNode;
  badges?: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  title: React.ReactNode;
};

export function FoundationDetailHero({
  actions,
  avatar,
  badges,
  children,
  className,
  eyebrow,
  subtitle,
  title,
  ...props
}: FoundationDetailHeroProps) {
  return (
    <section className={cn('foundationDetailHero', className)} {...props}>
      <div className="foundationDetailHeroIdentity">
        {avatar ? <span className="foundationDetailAvatar">{avatar}</span> : null}
        <div className="foundationDetailHeroText">
          {eyebrow ? <span className="foundationDetailEyebrow">{eyebrow}</span> : null}
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
          {badges ? <div className="foundationDetailBadges">{badges}</div> : null}
          {children}
        </div>
      </div>
      {actions ? <div className="foundationDetailHeroActions">{actions}</div> : null}
    </section>
  );
}

type FoundationDetailMetricGridProps = React.HTMLAttributes<HTMLDivElement>;

export function FoundationDetailMetricGrid({ children, className, ...props }: FoundationDetailMetricGridProps) {
  return (
    <div className={cn('foundationDetailMetricGrid', className)} {...props}>
      {children}
    </div>
  );
}

type FoundationDetailMetricProps = React.HTMLAttributes<HTMLDivElement> & {
  description?: React.ReactNode;
  icon?: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
};

export function FoundationDetailMetric({
  className,
  description,
  icon: Icon,
  label,
  value,
  ...props
}: FoundationDetailMetricProps) {
  return (
    <div className={cn('foundationDetailMetric', className)} {...props}>
      <div>
        <span>{label}</span>
        <strong>{hasDetailValue(value) ? value : '-'}</strong>
        {description ? <small>{description}</small> : null}
      </div>
      {Icon ? (
        <span className="foundationDetailMetricIcon">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}

type FoundationDetailSectionProps = React.HTMLAttributes<HTMLElement> & {
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
};

export function FoundationDetailSection({
  actions,
  badge,
  children,
  className,
  description,
  title,
  ...props
}: FoundationDetailSectionProps) {
  return (
    <section className={cn('foundationDetailSection', className)} {...props}>
      <header className="foundationDetailSectionHeader">
        <div>
          <h4>{title}</h4>
          {description ? <p>{description}</p> : null}
        </div>
        {badge || actions ? (
          <div className="foundationDetailSectionActions">
            {badge}
            {actions}
          </div>
        ) : null}
      </header>
      <div className="foundationDetailSectionBody">{children}</div>
    </section>
  );
}

type FoundationDetailFieldGridProps = React.HTMLAttributes<HTMLDivElement>;

export function FoundationDetailFieldGrid({ children, className, ...props }: FoundationDetailFieldGridProps) {
  return (
    <div className={cn('foundationDetailFieldGrid', className)} {...props}>
      {children}
    </div>
  );
}

type FoundationDetailFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label: React.ReactNode;
  span?: 'full' | 'half';
  value?: React.ReactNode;
};

export function FoundationDetailField({
  children,
  className,
  label,
  span = 'half',
  value,
  ...props
}: FoundationDetailFieldProps) {
  return (
    <div className={cn('foundationDetailField', `span-${span}`, className)} {...props}>
      <span>{label}</span>
      <strong>{hasDetailValue(children) ? children : hasDetailValue(value) ? value : '-'}</strong>
    </div>
  );
}
