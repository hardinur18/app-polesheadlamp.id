import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DayPicker, type CaptionProps, type DateRange, useNavigation } from "react-day-picker";

import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const RELATIVE_PRESETS = [
  { key: "today", label: "Real-time" },
  { key: "yesterday", label: "Kemarin" },
  { key: "last_7_days", label: "7 hari sebelumnya." },
  { key: "last_30_days", label: "30 hari sebelumnya." },
] as const;

type RelativePresetKey = (typeof RELATIVE_PRESETS)[number]["key"];
type PeriodPanelMode = "relative" | "day" | "week" | "month" | "year";

type PeriodFilterPickerProps = {
  date?: DateRange;
  setDate: (date?: DateRange) => void;
  className?: string;
  contentClassName?: string;
  triggerLabelMode?: "full" | "compact";
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

const formatDateLabel = (value: string) => {
  const parsed = parseDateKey(value);
  if (!parsed) return "-";
  return format(parsed, "dd/MM/yyyy", { locale: localeId });
};

const formatShortDateLabel = (value: string) => {
  const parsed = parseDateKey(value);
  if (!parsed) return "-";
  return format(parsed, "d MMM yyyy", { locale: localeId });
};

function PeriodCaption({ displayMonth }: CaptionProps) {
  const { goToMonth } = useNavigation();
  const label = format(displayMonth, "MMMM yyyy", { locale: localeId });

  return (
    <div className="periodPickerCaption">
      <div className="periodPickerCaptionGroup">
        <button type="button" onClick={() => goToMonth(subYears(displayMonth, 1))} className="periodPickerNavButton" title="Tahun sebelumnya">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => goToMonth(subMonths(displayMonth, 1))} className="periodPickerNavButton" title="Bulan sebelumnya">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <span className="periodPickerCaptionLabel">{label}</span>
      <div className="periodPickerCaptionGroup">
        <button type="button" onClick={() => goToMonth(addMonths(displayMonth, 1))} className="periodPickerNavButton" title="Bulan berikutnya">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => goToMonth(addYears(displayMonth, 1))} className="periodPickerNavButton" title="Tahun berikutnya">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const dayPickerClassNames = {
  months: "flex gap-4",
  month: "flex flex-col gap-2",
  caption: "flex justify-center relative items-center w-full",
  caption_label: "text-sm font-medium",
  nav: "hidden",
  nav_button: "hidden",
  nav_button_previous: "hidden",
  nav_button_next: "hidden",
  table: "w-full border-collapse",
  head_row: "flex",
  head_cell: "text-slate-400 rounded-[var(--radius-control)] w-9 font-medium text-[11px] text-center",
  row: "flex w-full mt-1",
  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-blue-50 [&:has([aria-selected].day-range-end)]:rounded-r-[var(--radius-control)] [&:has(>.day-range-end)]:rounded-r-[var(--radius-control)] [&:has(>.day-range-start)]:rounded-l-[var(--radius-control)] first:[&:has([aria-selected])]:rounded-l-[var(--radius-control)] last:[&:has([aria-selected])]:rounded-r-[var(--radius-control)]",
  day: "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-control)] p-0 text-[13px] font-normal transition-colors hover:bg-[color:var(--surface-soft)] aria-selected:opacity-100",
  day_range_start: "day-range-start aria-selected:rounded-l-[var(--radius-control)] aria-selected:bg-blue-500 aria-selected:text-white aria-selected:hover:bg-blue-500",
  day_range_end: "day-range-end aria-selected:rounded-r-[var(--radius-control)] aria-selected:bg-blue-500 aria-selected:text-white aria-selected:hover:bg-blue-500",
  day_selected: "bg-blue-500 text-white hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white",
  day_today: "bg-slate-100 font-semibold",
  day_outside: "day-outside text-slate-300 aria-selected:text-slate-400",
  day_disabled: "text-slate-300",
  day_range_middle: "aria-selected:bg-blue-50 aria-selected:text-blue-700",
  day_hidden: "invisible",
};

export function PeriodFilterPicker({ date, setDate, className, contentClassName, triggerLabelMode = "full" }: PeriodFilterPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [panelMode, setPanelMode] = React.useState<PeriodPanelMode>("month");
  const [pickerMonth, setPickerMonth] = React.useState(() => new Date());
  const [pickerYear, setPickerYear] = React.useState(() => new Date().getFullYear());

  const timezoneLabel = React.useMemo(() => {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const hour = String(Math.floor(abs / 60)).padStart(2, "0");
    const minute = String(abs % 60).padStart(2, "0");
    const label = `GMT${sign}${hour}:${minute}`;
    return label.endsWith(":00") ? label.replace(":00", "") : label;
  }, []);

  const dateFrom = date?.from ? toDateKey(date.from) : "";
  const dateTo = date?.to ? toDateKey(date.to) : date?.from ? toDateKey(date.from) : "";
  const selectedFromDate = React.useMemo(() => parseDateKey(dateFrom), [dateFrom]);
  const selectedToDate = React.useMemo(() => parseDateKey(dateTo), [dateTo]);

  const activeRelativePreset = React.useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const now = new Date();
    const today = toDateKey(now);
    const yesterday = toDateKey(subDays(now, 1));
    const last7 = toDateKey(subDays(now, 6));
    const last30 = toDateKey(subDays(now, 29));
    if (dateFrom === today && dateTo === today) return RELATIVE_PRESETS[0];
    if (dateFrom === yesterday && dateTo === yesterday) return RELATIVE_PRESETS[1];
    if (dateFrom === last7 && dateTo === today) return RELATIVE_PRESETS[2];
    if (dateFrom === last30 && dateTo === today) return RELATIVE_PRESETS[3];
    return null;
  }, [dateFrom, dateTo]);

  const isCurrentMonthRange = React.useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    const now = new Date();
    return dateFrom === toDateKey(startOfMonth(now)) && dateTo === toDateKey(now);
  }, [dateFrom, dateTo]);

  const summaryLabel = React.useMemo(() => {
    if (!dateFrom && !dateTo) return `Semua Waktu (${timezoneLabel})`;
    if (isCurrentMonthRange) return `Bulan Ini (${timezoneLabel})`;
    if (triggerLabelMode === "compact") {
      if (activeRelativePreset) return `${activeRelativePreset.label} (${timezoneLabel})`;
      if (dateFrom && dateTo) {
        if (dateFrom === dateTo) return `${formatShortDateLabel(dateFrom)} (${timezoneLabel})`;
        return `${formatShortDateLabel(dateFrom)} - ${formatShortDateLabel(dateTo)}`;
      }
      return `${formatShortDateLabel(dateFrom || dateTo)} (${timezoneLabel})`;
    }
    if (activeRelativePreset) {
      return `${activeRelativePreset.label} ${formatDateLabel(dateFrom)}-${formatDateLabel(dateTo)} (${timezoneLabel})`;
    }
    if (dateFrom && dateTo) return `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)} (${timezoneLabel})`;
    return `${formatDateLabel(dateFrom || dateTo)} (${timezoneLabel})`;
  }, [activeRelativePreset, dateFrom, dateTo, isCurrentMonthRange, timezoneLabel, triggerLabelMode]);

  const applyRange = React.useCallback((fromDate: Date, toDate: Date) => {
    setDate({ from: fromDate, to: toDate });
    setIsOpen(false);
  }, [setDate]);

  const applyPeriodPreset = (preset: "all" | RelativePresetKey) => {
    const now = new Date();
    if (preset === "all") {
      setDate(undefined);
      setPanelMode("relative");
      setIsOpen(false);
      return;
    }
    if (preset === "today") return applyRange(now, now);
    if (preset === "yesterday") {
      const yesterday = subDays(now, 1);
      return applyRange(yesterday, yesterday);
    }
    if (preset === "last_7_days") return applyRange(subDays(now, 6), now);
    return applyRange(subDays(now, 29), now);
  };

  const applyYearOnly = (year: number) => {
    const now = new Date();
    const endDate = year === now.getFullYear() ? now : new Date(year, 11, 31);
    applyRange(new Date(year, 0, 1), endDate);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          const base = selectedFromDate || new Date();
          setPickerMonth(base);
          setPickerYear(base.getFullYear());
          setPanelMode(isCurrentMonthRange ? "month" : activeRelativePreset ? "relative" : "month");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("uiPeriodPicker", className)}>
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="min-w-0 truncate">{summaryLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("periodPickerContent", contentClassName)}>
        <div className="periodPickerShell">
          <aside className="periodPickerSidebar">
            <div className="periodPickerPresetGroup">
              {RELATIVE_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.key}
                  onClick={() => applyPeriodPreset(preset.key)}
                  className={cn("periodPickerPreset", activeRelativePreset?.key === preset.key && "is-active")}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="periodPickerDivider" />
            <div className="periodPickerPresetGroup">
              {[
                ["day", "Per Hari"],
                ["week", "Per Minggu"],
                ["month", "Per Bulan"],
                ["year", "Berdasarkan Tahun"],
              ].map(([mode, label]) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setPanelMode(mode as PeriodPanelMode)}
                  className={cn("periodPickerPreset", panelMode === mode && "is-active")}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => applyPeriodPreset("all")} className="periodPickerPreset">
                Semua Waktu
              </button>
            </div>
          </aside>

          <section className="periodPickerMain">
            {panelMode === "day" && (
              <DayPicker
                mode="single"
                locale={localeId}
                showOutsideDays
                month={pickerMonth}
                onMonthChange={setPickerMonth}
                selected={selectedFromDate}
                onSelect={(day) => {
                  if (day) applyRange(day, day);
                }}
                components={{ Caption: PeriodCaption }}
                classNames={dayPickerClassNames}
              />
            )}

            {panelMode === "relative" && (
              <DayPicker
                mode="range"
                locale={localeId}
                showOutsideDays
                month={pickerMonth}
                onMonthChange={setPickerMonth}
                selected={selectedFromDate && selectedToDate ? { from: selectedFromDate, to: selectedToDate } : undefined}
                onSelect={(range) => {
                  if (range?.from && range.to) applyRange(range.from, range.to);
                }}
                components={{ Caption: PeriodCaption }}
                classNames={dayPickerClassNames}
              />
            )}

            {panelMode === "week" && (
              <DayPicker
                mode="range"
                locale={localeId}
                showOutsideDays
                month={pickerMonth}
                onMonthChange={setPickerMonth}
                selected={selectedFromDate && selectedToDate ? { from: selectedFromDate, to: selectedToDate } : undefined}
                onDayClick={(day) => {
                  applyRange(startOfWeek(day, { weekStartsOn: 1 }), endOfWeek(day, { weekStartsOn: 1 }));
                }}
                components={{ Caption: PeriodCaption }}
                classNames={dayPickerClassNames}
              />
            )}

            {panelMode === "month" && (
              <>
                <div className="periodPickerYearHeader">
                  <button type="button" onClick={() => setPickerYear((prev) => prev - 1)} className="periodPickerNavButton">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>{pickerYear}</span>
                  <button type="button" onClick={() => setPickerYear((prev) => prev + 1)} className="periodPickerNavButton">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="periodPickerMonthGrid">
                  {MONTH_NAMES_ID.map((monthName, index) => {
                    const start = new Date(pickerYear, index, 1);
                    const now = new Date();
                    const end = pickerYear === now.getFullYear() && index === now.getMonth() ? now : endOfMonth(start);
                    return (
                      <button type="button" key={monthName} onClick={() => applyRange(start, end)} className="periodPickerChoice">
                        {monthName.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {panelMode === "year" && (
              <>
                <div className="periodPickerYearHeader">
                  <button type="button" onClick={() => setPickerYear((prev) => prev - 12)} className="periodPickerNavButton">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>Pilih Tahun</span>
                  <button type="button" onClick={() => setPickerYear((prev) => prev + 12)} className="periodPickerNavButton">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="periodPickerMonthGrid">
                  {Array.from({ length: 12 }, (_, index) => pickerYear - 5 + index).map((year) => (
                    <button type="button" key={year} onClick={() => applyYearOnly(year)} className="periodPickerChoice">
                      {year}
                    </button>
                  ))}
                </div>
              </>
            )}

            <footer className="periodPickerFooter">
              <p>{summaryLabel}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Tutup
              </Button>
            </footer>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}
