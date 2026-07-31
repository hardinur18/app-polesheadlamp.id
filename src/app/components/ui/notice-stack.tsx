import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from './utils';

type NoticeTone = 'warning' | 'danger' | 'info' | 'success';

const toneIcon: Record<NoticeTone, React.ComponentType<{ className?: string }>> = {
  warning: AlertCircle,
  danger: XCircle,
  info: Info,
  success: CheckCircle2,
};

export type NoticeItem = {
  id: string;
  title?: React.ReactNode;
  message: React.ReactNode;
  tone?: NoticeTone;
};

type NoticeStackProps = React.HTMLAttributes<HTMLDivElement> & {
  notices: NoticeItem[];
};

export function NoticeStack({ notices, className, ...props }: NoticeStackProps) {
  if (notices.length === 0) return null;

  return (
    <div className={cn('noticeStack', className)} role="status" aria-live="polite" {...props}>
      {notices.map((notice) => {
        const tone = notice.tone ?? 'info';
        const Icon = toneIcon[tone];

        return (
          <span
            key={notice.id}
            className={cn('noticeIconButton', `noticeIconButton-${tone}`)}
            tabIndex={0}
            aria-label={typeof notice.message === 'string' ? notice.message : 'Pemberitahuan'}
          >
            <Icon className="noticeIcon" />
            <span className="noticeHoverText">
              {notice.title && <span className="noticeHoverTitle">{notice.title}</span>}
              <span>{notice.message}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
