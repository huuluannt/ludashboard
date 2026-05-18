import type { LuCalendarEvent, VisibleDay } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getVisibleMonthDays(month: Date): VisibleDay[] {
  const firstDay = startOfMonth(month);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const todayKey = toDateKey(new Date());
  const days: VisibleDay[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = new Date(cursor.getTime() + DAY_MS)) {
    days.push({
      date: cursor,
      key: toDateKey(cursor),
      inMonth: cursor.getMonth() === month.getMonth(),
      isToday: toDateKey(cursor) === todayKey,
    });
  }
  return days;
}

export function getGridRange(days: VisibleDay[]) {
  const first = days[0]?.date ?? new Date();
  const last = days[days.length - 1]?.date ?? first;
  const timeMin = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0);
  const timeMax = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1, 0, 0, 0, 0);
  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  };
}

export function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function formatDayTitle(date: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function formatEventTime(event: LuCalendarEvent) {
  if (event.allDay) return 'All day';
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime())) return '';
  const format = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${format.format(start)}${Number.isNaN(end.getTime()) ? '' : ` - ${format.format(end)}`}`;
}

export function mapEventsByDay(events: LuCalendarEvent[]) {
  const map = new Map<string, LuCalendarEvent[]>();
  for (const event of events) {
    const key = getEventStartKey(event);
    const current = map.get(key) || [];
    current.push(event);
    map.set(key, current);
  }

  for (const dayEvents of map.values()) {
    dayEvents.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }
  return map;
}

export function getEventStartKey(event: LuCalendarEvent) {
  if (event.allDay) return event.start.slice(0, 10);
  const date = new Date(event.start);
  if (Number.isNaN(date.getTime())) return event.start.slice(0, 10);
  return toDateKey(date);
}

export function getDefaultEventTimes() {
  const now = new Date();
  const startHour = Math.min(22, now.getHours() + 1);
  return {
    startTime: `${String(startHour).padStart(2, '0')}:00`,
    endTime: `${String(startHour + 1).padStart(2, '0')}:00`,
  };
}

