import * as React from "react"
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { id } from "date-fns/locale"

import { cn } from "@/app/components/ui/utils"
import { Button } from "@/app/components/ui/button"
import { Calendar } from "@/app/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"

interface SmartFilterDateProps {
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  className?: string
}

export type SmartFilterPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'

export function getSmartFilterPresetRange(type: SmartFilterPreset, now = new Date()): DateRange {
  switch (type) {
    case 'all':
      return { from: new Date(2023, 0, 1), to: now }
    case 'today':
      return { from: now, to: now }
    case 'yesterday': {
      const yesterday = addDays(now, -1)
      return { from: yesterday, to: yesterday }
    }
    case 'thisWeek':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      }
    case 'lastWeek': {
      const lastWeek = addDays(now, -7)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      }
    }
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1)
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
    }
    case 'last3Months': {
      const threeMonthsAgo = subMonths(now, 3)
      return { from: startOfMonth(threeMonthsAgo), to: now }
    }
  }
}

export function getSmartFilterPresetEntries(now = new Date()) {
  const presets: Array<{ type: SmartFilterPreset; label: string; range: DateRange }> = [
    { type: 'all', label: 'Semua Waktu', range: getSmartFilterPresetRange('all', now) },
    { type: 'today', label: 'Hari Ini', range: getSmartFilterPresetRange('today', now) },
    { type: 'yesterday', label: 'Kemarin', range: getSmartFilterPresetRange('yesterday', now) },
    { type: 'thisWeek', label: 'Minggu Ini', range: getSmartFilterPresetRange('thisWeek', now) },
    { type: 'lastWeek', label: '1 Minggu Terakhir', range: getSmartFilterPresetRange('lastWeek', now) },
    { type: 'thisMonth', label: 'Bulan Ini', range: getSmartFilterPresetRange('thisMonth', now) },
    { type: 'lastMonth', label: '1 Bulan Terakhir', range: getSmartFilterPresetRange('lastMonth', now) },
    { type: 'last3Months', label: '3 Bulan Terakhir', range: getSmartFilterPresetRange('last3Months', now) },
  ]

  return presets
}

function getRangeKey(range: DateRange | undefined) {
  if (!range?.from) return 'empty'

  const from = format(range.from, 'yyyy-MM-dd')
  const to = format(range.to || range.from, 'yyyy-MM-dd')
  return `${from}:${to}`
}

export function SmartFilterDate({
  date,
  setDate,
  className,
}: SmartFilterDateProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date>(() => date?.from || new Date())

  React.useEffect(() => {
    if (date?.from) {
      setMonth(date.from)
    }
  }, [date?.from])

  const presetEntries = React.useMemo(() => getSmartFilterPresetEntries(new Date()), [isOpen])

  const setPreset = (type: SmartFilterPreset) => {
    const selectedPreset = presetEntries.find((preset) => preset.type === type)
    if (!selectedPreset) return

    if (getRangeKey(date) === getRangeKey(selectedPreset.range)) {
      setIsOpen(false)
      return
    }

    setMonth(selectedPreset.range.from || new Date())
    setDate({
      from: selectedPreset.range.from,
      to: selectedPreset.range.to || selectedPreset.range.from,
    })
    setIsOpen(false)
  }

  const formatDateDisplay = () => {
    if (!date?.from) return <span>Pilih Tanggal</span>
    if (!date.to) return <span>{format(date.from, "LLL dd, y", { locale: id })}</span>
    return (
      <span>
        {format(date.from, "LLL dd, y", { locale: id })} - {format(date.to, "LLL dd, y", { locale: id })}
      </span>
    )
  }

  return (
    <div className={cn("filterDateField grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "filterDateButton w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
            {formatDateDisplay()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[200] w-auto p-0 border-slate-200 dark:border-slate-700 shadow-lg rounded-xl" align="end">
          <div className="flex flex-col md:flex-row">
            {/* Sidebar Presets */}
            <div className="flex flex-col border-b border-slate-200 dark:border-slate-700 md:border-b-0 md:border-r p-2 gap-1 min-w-[150px]">
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('all')}>
                Semua Waktu
              </Button>
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('today')}>
                Hari Ini
              </Button>
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('yesterday')}>
                Kemarin
              </Button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('thisWeek')}>
                Minggu Ini
              </Button>
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('lastWeek')}>
                1 Minggu Terakhir
              </Button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('thisMonth')}>
                Bulan Ini
              </Button>
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('lastMonth')}>
                1 Bulan Terakhir
              </Button>
              <Button variant="ghost" className="justify-start text-sm font-normal hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setPreset('last3Months')}>
                3 Bulan Terakhir
              </Button>
            </div>
            
            {/* Calendar */}
            <div className="p-2">
              <Calendar
                initialFocus
                mode="range"
                month={month}
                onMonthChange={setMonth}
                selected={date}
                onSelect={(range) => {
                  if (range?.from) {
                    setMonth(range.from)
                  }
                  setDate(range)
                }}
                numberOfMonths={1}
                locale={id}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
