"use client"

import * as React from "react"
import { format, startOfToday, endOfToday, startOfYesterday, endOfYesterday, subWeeks, subMonths } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { id } from "date-fns/locale"

import { cn } from "./utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

export { FoundationDateRangePicker, PeriodFilterPicker } from "./period-filter-picker"
export type { PeriodFilterPickerProps } from "./period-filter-picker"

export function DatePickerWithRange({
  className,
  popoverClassName,
  compact = false,
  numberOfMonths = compact ? 1 : 2,
  date,
  setDate,
}: {
  className?: string
  popoverClassName?: string
  compact?: boolean
  numberOfMonths?: 1 | 2
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)

  const presets = [
    {
      label: "Hari Ini",
      getValue: () => {
        const today = startOfToday()
        return { from: today, to: endOfToday() }
      },
    },
    {
      label: "Kemarin",
      getValue: () => {
        const yesterday = startOfYesterday()
        return { from: yesterday, to: endOfYesterday() }
      },
    },
    {
      label: "1 Minggu Terakhir",
      getValue: () => {
        const today = startOfToday()
        return { from: subWeeks(today, 1), to: today }
      },
    },
    {
      label: "1 Bulan Terakhir",
      getValue: () => {
        const today = startOfToday()
        return { from: subMonths(today, 1), to: today }
      },
    },
    {
      label: "3 Bulan Terakhir",
      getValue: () => {
        const today = startOfToday()
        return { from: subMonths(today, 3), to: today }
      },
    },
  ]

  return (
    <div className={cn("filterDateField grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "filterDateButton w-[260px] justify-start text-slate-700 transition-colors dark:text-slate-200",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
            {date?.from ? (
              date.to ? (
                <span className="text-slate-700 dark:text-slate-200">
                  {format(date.from, "d MMM yyyy", { locale: id })} -{" "}
                  {format(date.to, "d MMM yyyy", { locale: id })}
                </span>
              ) : (
                <span className="text-slate-700 dark:text-slate-200">
                  {format(date.from, "d MMM yyyy", { locale: id })}
                </span>
              )
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Pilih tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={cn(
            "z-[60] w-auto overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl dark:border-slate-700 dark:bg-slate-900",
            popoverClassName,
          )}
          align="start"
        >
          <div className={cn("dateRangePickerLayout flex flex-col sm:flex-row", compact && "isCompact")}>
            <div className="dateRangePresetList flex min-w-[140px] flex-col gap-1 border-r border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-950/70">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  className="h-8 justify-start px-3 text-sm font-normal text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onClick={() => {
                    setDate(preset.getValue())
                    setOpen(false)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="dateRangeCalendarPanel bg-white p-2 dark:bg-slate-900">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={numberOfMonths}
                locale={id}
                className="pointer-events-auto bg-white dark:bg-slate-900"
                classNames={compact ? {
                  months: "flex flex-col gap-2",
                  month: "flex flex-col gap-3",
                  caption: "flex justify-center pt-1 relative items-center w-full",
                  caption_label: "text-sm font-semibold",
                  nav: "flex items-center gap-1",
                  nav_button: "h-8 w-8 border-0 bg-transparent p-0 text-slate-500 opacity-100 shadow-none hover:bg-transparent hover:text-slate-900 focus-visible:ring-0 focus-visible:ring-offset-0",
                  nav_button_previous: "absolute left-0",
                  nav_button_next: "absolute right-0",
                  head_cell: "text-muted-foreground rounded-md w-9 font-medium text-[0.72rem]",
                  row: "flex w-full mt-1.5",
                  day: "h-9 w-9 p-0 rounded-xl text-sm font-semibold aria-selected:opacity-100",
                } : undefined}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
