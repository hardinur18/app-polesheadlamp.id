import React from 'react';
import { Bell, Info, CheckCircle, XCircle, History, Wallet, User as UserIcon, FileText } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { ScrollArea } from './scroll-area';
import { useMasterData } from '../../pages/master-data/context';
import { cn } from './utils';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router';
import { usePermissions } from '@/app/hooks/usePermissions';

export function NotificationBell({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { auditLogs = [] } = useMasterData();
  const navigate = useNavigate(); // Still keep for safety, but prefer prop
  const { hasPermission } = usePermissions();
  const canViewAuditLogs = hasPermission('audit_logs.view');

  const handleNavigate = () => {
      if (onNavigate) {
          onNavigate('audit-logs');
      } else {
          // Fallback if not used in AppLayout context
          navigate('/audit-logs'); 
      }
  };

  // Filter Logic: Owner sees all, others might see limit?
  // For now, let's show all logs to everyone but limit to 10 latest
  const recentLogs = React.useMemo(() => {
    return auditLogs.slice(0, 10);
  }, [auditLogs]);

  if (!canViewAuditLogs) {
    return null;
  }

  const getIcon = (action: string) => {
      const act = action.toUpperCase();
      if (act.includes('CREATE')) return <CheckCircle className="h-4 w-4 text-green-500" />;
      if (act.includes('UPDATE')) return <Info className="h-4 w-4 text-blue-500" />;
      if (act.includes('DELETE')) return <XCircle className="h-4 w-4 text-red-500" />;
      if (act.includes('PAYMENT')) return <Wallet className="h-4 w-4 text-emerald-500" />;
      if (act.includes('LOGIN')) return <UserIcon className="h-4 w-4 text-slate-500" />;
      return <FileText className="h-4 w-4 text-slate-500" />;
  };

  const getBadgeColor = (action: string) => {
      const act = action.toUpperCase();
      if (act.includes('CREATE')) return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40";
      if (act.includes('UPDATE')) return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40";
      if (act.includes('DELETE')) return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40";
      if (act.includes('PAYMENT')) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40";
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="appTopbarButton appTopbarSecondaryAction relative">
          <Bell className="h-5 w-5" />
          {/* Dot to indicate activity, simpler than count since we don't track 'read' state on server yet */}
          {recentLogs.length > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="appDropdownPanel w-[min(380px,calc(100vw-24px))]">
        <DropdownMenuLabel className="flex justify-between items-center py-3">
            <span className="appDropdownLabel">Aktivitas Terbaru</span>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleNavigate}
                className="buttonSm"
            >
                Lihat Semua
            </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="appDropdownSeparator" />
        <ScrollArea className="h-[380px]">
            {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500 p-4">
                    <History className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-sm">Belum ada aktivitas tercatat.</p>
                </div>
            ) : (
                <div className="flex flex-col">
                    {recentLogs.map((log) => (
                        <DropdownMenuItem 
                            key={log.id} 
                            className="appDropdownItem flex flex-col items-start gap-1 p-3 cursor-default border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                        >
                            <div className="flex items-start gap-3 w-full">
                                <div className="mt-1 shrink-0">
                                    {getIcon(log.action)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">
                                            {log.entity}
                                        </p>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: id })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        <span className="font-medium text-slate-900 dark:text-slate-100 mr-1">{log.user_name || 'System'}</span>
                                        {log.details.replace(`${log.user_name}: `, '')}
                                    </p>
                                    <div className="flex items-center gap-2 pt-1">
                                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide", getBadgeColor(log.action))}>
                                            {log.action}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </div>
            )}
        </ScrollArea>
        <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={handleNavigate}>
                Lihat Riwayat Lengkap
            </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
