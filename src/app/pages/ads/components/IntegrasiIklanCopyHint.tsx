import { HelpCircle } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';

export function IntegrasiIklanCopyHint({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Lihat definisi istilah"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[260px] bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
