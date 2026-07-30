import { format, parseISO, subDays } from 'date-fns';

export const getTodayDateKey = (date = new Date()) => format(date, 'yyyy-MM-dd');

export const getPreviousDateKey = (dateKey: string) => format(subDays(parseISO(dateKey), 1), 'yyyy-MM-dd');
