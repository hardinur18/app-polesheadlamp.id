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

const SHORT_MONTH_NAMES_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agt",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const RELATIVE_PRESETS = [
  { key: "today", label: "Hari Ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "current_week", label: "Minggu Ini" },
  { key: "last_7_days", label: "1 Minggu Terakhir" },
  { key: "current_month", label: "Bulan Ini" },
  { key: "last_30_days", label: "1 Bulan Terakhir" },
  { key: "last_90_days", label: "3 Bulan Terakhir" },
] as const;

type RelativePresetKey = (typeof RELATIVE_PRESETS)[number]["key"];
type RelativePreset = (typeof RELATIVE_PRESETS)[number];
type PeriodPanelMode = "relative" | "day" | "week" | "month" | "year";
type PeriodFilterPickerVariant = "default" | "foundation";

export type PeriodFilterPickerProps = {
  date?: DateRange;
  setDate: (date?: DateRange) => void;
  className?: string;
  contentClassName?: string;
  numberOfMonths?: number;
  triggerLabelMode?: "full" | "compact";
  variant?: PeriodFilterPickerVariant;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sortRangeDates = (fromDate: Date, toDate: Date): Required<DateRange> => {
  if (toDateKey(fromDate) <= toDateKey(toDate)) {
    return { from: fromDate, to: toDate };
  }
  return { from: toDate, to: fromDate };
};

const getRelativePresetForRange = (dateFrom: string, dateTo: string): RelativePreset | null => {
  if (!dateFrom || !dateTo) return null;
  const now = new Date();
  const today = toDateKey(now);
  const yesterday = toDateKey(subDays(now, 1));
  const currentWeek = toDateKey(startOfWeek(now, { weekStartsOn: 1 }));
  const last7 = toDateKey(subDays(now, 6));
  const currentMonth = toDateKey(startOfMonth(now));
  const last30 = toDateKey(subDays(now, 29));
  const last90 = toDateKey(subMonths(now, 3));
  if (dateFrom === today && dateTo === today) return RELATIVE_PRESETS[0];
  if (dateFrom === yesterday && dateTo === yesterday) return RELATIVE_PRESETS[1];
  if (dateFrom === currentWeek && dateTo === today) return RELATIVE_PRESETS[2];
  if (dateFrom === last7 && dateTo === today) return RELATIVE_PRESETS[3];
  if (dateFrom === currentMonth && dateTo === today) return RELATIVE_PRESETS[4];
  if (dateFrom === last30 && dateTo === today) return RELATIVE_PRESETS[5];
  if (dateFrom === last90 && dateTo === today) return RELATIVE_PRESETS[6];
  return null;
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
  return `${parsed.getDate()} ${SHORT_MONTH_NAMES_ID[parsed.getMonth()]} ${parsed.getFullYear()}`;
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
  months: "flex gap-6",
  month: "flex flex-col gap-3",
  caption: "flex justify-center relative items-center w-full",
  caption_label: "text-sm font-medium",
  nav: "hidden",
  nav_button: "hidden",
  nav_button_previous: "hidden",
  nav_button_next: "hidden",
  table: "w-full border-collapse",
  head_row: "flex",
  head_cell: "text-slate-500 w-10 font-medium text-[13px] text-center",
  row: "flex w-full mt-1.5",
  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
  day: "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md p-0 text-[15px] font-semibold transition-colors hover:bg-slate-100 aria-selected:opacity-100",
  day_range_start: "day-range-start aria-selected:bg-blue-600 aria-selected:text-white aria-selected:hover:bg-blue-600",
  day_range_end: "day-range-end aria-selected:bg-blue-600 aria-selected:text-white aria-selected:hover:bg-blue-600",
  day_selected: "bg-blue-500 text-white hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white",
  day_today: "bg-slate-100 font-semibold",
  day_outside: "day-outside text-slate-300 aria-selected:text-slate-400",
  day_disabled: "text-slate-300",
  day_range_middle: "aria-selected:bg-slate-100 aria-selected:text-slate-950",
  day_hidden: "invisible",
};

const useCompactPeriodPicker = (enabled: boolean) => {
  const [isCompact, setIsCompact] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setIsCompact(false);
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncCompactState = () => setIsCompact(mediaQuery.matches);

    syncCompactState();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncCompactState);
      return () => mediaQuery.removeEventListener("change", syncCompactState);
    }

    mediaQuery.addListener(syncCompactState);
    return () => mediaQuery.removeListener(syncCompactState);
  }, [enabled]);

  return isCompact;
};

export function PeriodFilterPicker({
  date,
  setDate,
  className,
  contentClassName,
  numberOfMonths,
  triggerLabelMode,
  variant = "default",
}: PeriodFilterPickerProps) {
  const isFoundationVariant = variant === "foundation";
  const resolvedNumberOfMonths = numberOfMonths ?? (isFoundationVariant ? 2 : 1);
  const resolvedTriggerLabelMode = triggerLabelMode ?? (isFoundationVariant ? "compact" : "full");
  const isCompactFoundationPicker = useCompactPeriodPicker(isFoundationVariant);
  const calendarNumberOfMonths = isCompactFoundationPicker ? 1 : resolvedNumberOfMonths;
  const [isOpen, setIsOpen] = React.useState(false);
  const [panelMode, setPanelMode] = React.useState<PeriodPanelMode>("month");
  const [pickerMonth, setPickerMonth] = React.useState(() => new Date());
  const [pickerYear, setPickerYear] = React.useState(() => new Date().getFullYear());
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(undefined);
  const [hoveredRangeDate, setHoveredRangeDate] = React.useState<Date | undefined>(undefined);

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
  const selectedDateRange = React.useMemo<DateRange | undefined>(() => {
    if (!selectedFromDate) return undefined;
    return { from: selectedFromDate, to: selectedToDate || selectedFromDate };
  }, [selectedFromDate, selectedToDate]);

  const activeRelativePreset = React.useMemo(() => {
    return getRelativePresetForRange(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  const draftFrom = draftRange?.from ? toDateKey(draftRange.from) : "";
  const draftTo = draftRange?.to ? toDateKey(draftRange.to) : draftRange?.from ? toDateKey(draftRange.from) : "";
  const draftRelativePreset = React.useMemo(() => {
    return getRelativePresetForRange(draftFrom, draftTo);
  }, [draftFrom, draftTo]);
  const sidebarRelativePreset = draftRange?.from ? draftRelativePreset : activeRelativePreset;
  const visibleDraftRange = React.useMemo<DateRange | undefined>(() => {
    if (!draftRange?.from) return selectedDateRange;
    if (draftRange.to) return draftRange;
    if (hoveredRangeDate) return sortRangeDates(draftRange.from, hoveredRangeDate);
    return draftRange;
  }, [draftRange, hoveredRangeDate, selectedDateRange]);

  const isCurrentMonthRange = React.useMemo(() => {
    if (!dateFrom || !dateTo) return false;
    const now = new Date();
    return dateFrom === toDateKey(startOfMonth(now)) && dateTo === toDateKey(now);
  }, [dateFrom, dateTo]);
  const isCustomRangeActive = Boolean(dateFrom && dateTo && !activeRelativePreset)
    || Boolean(draftRange?.from && !draftRelativePreset);

  const summaryLabel = React.useMemo(() => {
    if (!dateFrom && !dateTo) return `Semua Waktu (${timezoneLabel})`;
    if (isCurrentMonthRange) return `Bulan Ini (${timezoneLabel})`;
    if (resolvedTriggerLabelMode === "compact") {
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
  }, [activeRelativePreset, dateFrom, dateTo, isCurrentMonthRange, timezoneLabel, resolvedTriggerLabelMode]);

  const draftSummaryLabel = React.useMemo(() => {
    if (!draftRange?.from) return summaryLabel;
    const displayRange = visibleDraftRange || draftRange;
    const from = displayRange.from ? toDateKey(displayRange.from) : "";
    const to = displayRange.to ? toDateKey(displayRange.to) : "";
    if (!to) return `${formatShortDateLabel(from)} - pilih tanggal akhir`;
    const preset = getRelativePresetForRange(from, to);
    if (preset) return `${preset.label} (${timezoneLabel})`;
    if (from === to) return `${formatShortDateLabel(from)} (${timezoneLabel})`;
    return `${formatShortDateLabel(from)} - ${formatShortDateLabel(to)}`;
  }, [draftRange, summaryLabel, timezoneLabel, visibleDraftRange]);

  const applyRange = React.useCallback((fromDate: Date, toDate: Date) => {
    setDraftRange({ from: fromDate, to: toDate });
    setHoveredRangeDate(undefined);
    setDate({ from: fromDate, to: toDate });
    setIsOpen(false);
  }, [setDate]);

  const handleRangeDayClick = React.useCallback((day: Date) => {
    setPanelMode("relative");
    setHoveredRangeDate(undefined);

    if (!draftRange?.from || draftRange.to) {
      setDraftRange({ from: day });
      return;
    }

    const completedRange = sortRangeDates(draftRange.from, day);
    applyRange(completedRange.from, completedRange.to);
  }, [applyRange, draftRange]);

  const handleRangeDayMouseEnter = React.useCallback((day: Date) => {
    if (draftRange?.from && !draftRange.to) {
      setHoveredRangeDate(day);
    }
  }, [draftRange]);

  const applyPeriodPreset = (preset: "all" | RelativePresetKey) => {
    const now = new Date();
    if (preset === "all") {
      setDraftRange(undefined);
      setHoveredRangeDate(undefined);
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
    if (preset === "current_week") return applyRange(startOfWeek(now, { weekStartsOn: 1 }), now);
    if (preset === "last_7_days") return applyRange(subDays(now, 6), now);
    if (preset === "current_month") return applyRange(startOfMonth(now), now);
    if (preset === "last_30_days") return applyRange(subDays(now, 29), now);
    return applyRange(subMonths(now, 3), now);
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
          setPanelMode("relative");
          setDraftRange(selectedDateRange);
          setHoveredRangeDate(undefined);
        } else {
          setDraftRange(undefined);
          setHoveredRangeDate(undefined);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("uiPeriodPicker", isFoundationVariant && "uiPeriodPicker--foundation", className)}>
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="min-w-0 truncate">{summaryLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("periodPickerContent", isFoundationVariant && "periodPickerContent--foundation", contentClassName)}>
        <div className="periodPickerShell">
          <aside className="periodPickerSidebar">
            <div className="periodPickerPresetGroup">
              <button
                type="button"
                onClick={() => applyPeriodPreset("all")}
                className={cn("periodPickerPreset", !dateFrom && !dateTo && "is-active")}
              >
                Semua Waktu
              </button>
              {RELATIVE_PRESETS.slice(0, 2).map((preset) => (
                <button
                  type="button"
                  key={preset.key}
                  onClick={() => applyPeriodPreset(preset.key)}
                  className={cn("periodPickerPreset", sidebarRelativePreset?.key === preset.key && "is-active")}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="periodPickerDivider" />
            <div className="periodPickerPresetGroup">
              {RELATIVE_PRESETS.slice(2, 4).map((preset) => (
                <button
                  type="button"
                  key={preset.key}
                  onClick={() => applyPeriodPreset(preset.key)}
                  className={cn("periodPickerPreset", sidebarRelativePreset?.key === preset.key && "is-active")}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="periodPickerDivider" />
            <div className="periodPickerPresetGroup">
              {RELATIVE_PRESETS.slice(4).map((preset) => (
                <button
                  type="button"
                  key={preset.key}
                  onClick={() => applyPeriodPreset(preset.key)}
                  className={cn("periodPickerPreset", sidebarRelativePreset?.key === preset.key && "is-active")}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPanelMode("relative");
                  setDraftRange(selectedDateRange);
                }}
                className={cn("periodPickerPreset", isCustomRangeActive && "is-active")}
              >
                Custom
              </button>
            </div>
          </aside>

          <section className="periodPickerMain">
            {panelMode === "day" && (
              <DayPicker
                mode="single"
                locale={localeId}
                showOutsideDays
                fixedWeeks
                month={pickerMonth}
                numberOfMonths={calendarNumberOfMonths}
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
                fixedWeeks
                month={pickerMonth}
                numberOfMonths={calendarNumberOfMonths}
                onMonthChange={setPickerMonth}
                selected={visibleDraftRange}
                onDayClick={handleRangeDayClick}
                onDayMouseEnter={handleRangeDayMouseEnter}
                components={{ Caption: PeriodCaption }}
                classNames={dayPickerClassNames}
              />
            )}

            {panelMode === "week" && (
              <DayPicker
                mode="range"
                locale={localeId}
                showOutsideDays
                fixedWeeks
                month={pickerMonth}
                numberOfMonths={calendarNumberOfMonths}
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
              <p>{draftSummaryLabel}</p>
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

export function FoundationDateRangePicker(props: Omit<PeriodFilterPickerProps, "variant">) {
  return <PeriodFilterPicker {...props} variant="foundation" />;
}
