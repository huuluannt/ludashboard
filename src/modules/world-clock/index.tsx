import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';

interface ClockCity {
  id: string;
  city: string;
  country: string;
  timeZone: string;
}

const STORAGE_KEY = 'lu:world-clock:selected';
const DEFAULT_CITY_IDS = ['ho-chi-minh', 'utc', 'tokyo', 'london', 'new-york'];

const CITY_TIMEZONES: ClockCity[] = [
  { id: 'ho-chi-minh', city: 'Ho Chi Minh City', country: 'Vietnam', timeZone: 'Asia/Ho_Chi_Minh' },
  { id: 'hanoi', city: 'Hanoi', country: 'Vietnam', timeZone: 'Asia/Ho_Chi_Minh' },
  { id: 'utc', city: 'UTC', country: 'Universal Time', timeZone: 'UTC' },
  { id: 'bangkok', city: 'Bangkok', country: 'Thailand', timeZone: 'Asia/Bangkok' },
  { id: 'singapore', city: 'Singapore', country: 'Singapore', timeZone: 'Asia/Singapore' },
  { id: 'kuala-lumpur', city: 'Kuala Lumpur', country: 'Malaysia', timeZone: 'Asia/Kuala_Lumpur' },
  { id: 'jakarta', city: 'Jakarta', country: 'Indonesia', timeZone: 'Asia/Jakarta' },
  { id: 'manila', city: 'Manila', country: 'Philippines', timeZone: 'Asia/Manila' },
  { id: 'hong-kong', city: 'Hong Kong', country: 'Hong Kong', timeZone: 'Asia/Hong_Kong' },
  { id: 'taipei', city: 'Taipei', country: 'Taiwan', timeZone: 'Asia/Taipei' },
  { id: 'beijing', city: 'Beijing', country: 'China', timeZone: 'Asia/Shanghai' },
  { id: 'seoul', city: 'Seoul', country: 'South Korea', timeZone: 'Asia/Seoul' },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo' },
  { id: 'delhi', city: 'New Delhi', country: 'India', timeZone: 'Asia/Kolkata' },
  { id: 'dubai', city: 'Dubai', country: 'United Arab Emirates', timeZone: 'Asia/Dubai' },
  { id: 'istanbul', city: 'Istanbul', country: 'Turkey', timeZone: 'Europe/Istanbul' },
  { id: 'paris', city: 'Paris', country: 'France', timeZone: 'Europe/Paris' },
  { id: 'berlin', city: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin' },
  { id: 'london', city: 'London', country: 'United Kingdom', timeZone: 'Europe/London' },
  { id: 'new-york', city: 'New York', country: 'United States', timeZone: 'America/New_York' },
  { id: 'chicago', city: 'Chicago', country: 'United States', timeZone: 'America/Chicago' },
  { id: 'denver', city: 'Denver', country: 'United States', timeZone: 'America/Denver' },
  { id: 'los-angeles', city: 'Los Angeles', country: 'United States', timeZone: 'America/Los_Angeles' },
  { id: 'toronto', city: 'Toronto', country: 'Canada', timeZone: 'America/Toronto' },
  { id: 'vancouver', city: 'Vancouver', country: 'Canada', timeZone: 'America/Vancouver' },
  { id: 'mexico-city', city: 'Mexico City', country: 'Mexico', timeZone: 'America/Mexico_City' },
  { id: 'sao-paulo', city: 'Sao Paulo', country: 'Brazil', timeZone: 'America/Sao_Paulo' },
  { id: 'buenos-aires', city: 'Buenos Aires', country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires' },
  { id: 'cairo', city: 'Cairo', country: 'Egypt', timeZone: 'Africa/Cairo' },
  { id: 'johannesburg', city: 'Johannesburg', country: 'South Africa', timeZone: 'Africa/Johannesburg' },
  { id: 'sydney', city: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney' },
  { id: 'melbourne', city: 'Melbourne', country: 'Australia', timeZone: 'Australia/Melbourne' },
  { id: 'auckland', city: 'Auckland', country: 'New Zealand', timeZone: 'Pacific/Auckland' },
];

const cityMap = new Map(CITY_TIMEZONES.map((city) => [city.id, city]));

export default function WorldClockModule() {
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [compareValue, setCompareValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(loadSelectedCityIds);
  const [copiedCityId, setCopiedCityId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

  const referenceDate = useMemo(() => {
    if (!compareValue) return now;
    const parsed = new Date(compareValue);
    return Number.isNaN(parsed.getTime()) ? now : parsed;
  }, [compareValue, now]);

  const selectedCities = useMemo(
    () => selectedIds.map((id) => cityMap.get(id)).filter((city): city is ClockCity => Boolean(city)),
    [selectedIds],
  );

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? CITY_TIMEZONES.filter((city) =>
          `${city.city} ${city.country} ${city.timeZone}`.toLowerCase().includes(normalized),
        )
      : CITY_TIMEZONES;
    return matches.slice(0, 12);
  }, [query]);

  const addCity = (cityId: string) => {
    setSelectedIds((current) => (current.includes(cityId) ? current : [...current, cityId]));
  };

  const removeCity = (cityId: string) => {
    setSelectedIds((current) => current.filter((id) => id !== cityId));
  };

  const copyClock = async (city: ClockCity) => {
    const snapshot = getClockSnapshot(city, referenceDate);
    await copyText(`${city.city}, ${city.country}: ${snapshot.time} ${snapshot.date} (${snapshot.offset})`);
    setCopiedCityId(city.id);
    window.setTimeout(() => {
      setCopiedCityId((current) => (current === city.id ? null : current));
    }, 1100);
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[190px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="globe" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">World Clock</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {selectedCities.length} clocks | {compareValue ? 'compare mode' : 'live'}
            </p>
          </div>
        </div>

        <label className="relative flex h-8 min-w-[200px] flex-1 md:max-w-xs">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-full w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder="Search city or timezone..."
          />
        </label>

        <input
          type="datetime-local"
          value={compareValue}
          onChange={(event) => setCompareValue(event.target.value)}
          className="h-8 min-w-[190px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white"
          title="Compare a local date and time"
        />

        <button
          type="button"
          onClick={() => setCompareValue('')}
          disabled={!compareValue}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name="clock" size={13} />
          Live
        </button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-[var(--color-surface-muted)] p-3 xl:grid-cols-[1fr_330px]">
        <section className="min-h-0 overflow-y-auto">
          {selectedCities.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-center shadow-sm">
              <div>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                  <Icon name="globe" size={26} />
                </div>
                <h3 className="text-base font-semibold">No clocks selected</h3>
                <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Add a city from the list.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {selectedCities.map((city) => (
                <ClockCard
                  key={city.id}
                  city={city}
                  date={referenceDate}
                  live={!compareValue}
                  copied={copiedCityId === city.id}
                  onCopy={() => void copyClock(city)}
                  onRemove={() => removeCity(city.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Add city</p>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">{CITY_TIMEZONES.length} zones</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {searchResults.map((city) => {
              const selected = selectedIds.includes(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => addCity(city.id)}
                  disabled={selected}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'cursor-default bg-blue-50 text-[var(--color-accent)]'
                      : 'hover:bg-[var(--color-surface-subtle)]'
                  }`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-white">
                    <Icon name={selected ? 'clock' : 'plus'} size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{city.city}</p>
                    <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">{city.country}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                    {formatOffset(getTimeZoneOffsetMinutes(city.timeZone, referenceDate))}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}

function ClockCard({
  city,
  date,
  live,
  copied,
  onCopy,
  onRemove,
}: {
  city: ClockCity;
  date: Date;
  live: boolean;
  copied: boolean;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const snapshot = getClockSnapshot(city, date);
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name={snapshot.periodIcon} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{city.city}</h3>
          <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">{city.country}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] transition-colors ${
              copied ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
            title={copied ? 'Copied' : 'Copy time'}
            aria-label="Copy time"
          >
            <Icon name="copy" size={13} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]"
            title="Remove clock"
            aria-label="Remove clock"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>

      <div className="mt-5">
        <p className="font-mono text-4xl font-semibold leading-none tracking-normal text-[var(--color-text-primary)]">
          {snapshot.time}
        </p>
        <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">{snapshot.date}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
          {snapshot.offset}
        </span>
        <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
          {snapshot.localDifference}
        </span>
        <span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
          {snapshot.period}
        </span>
        {live && (
          <span className="ml-auto rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            Live
          </span>
        )}
      </div>
    </article>
  );
}

function getClockSnapshot(city: ClockCity, date: Date) {
  const parts = getTimeZoneParts(city.timeZone, date);
  const offsetMinutes = getTimeZoneOffsetMinutes(city.timeZone, date);
  const localOffsetMinutes = -date.getTimezoneOffset();
  const difference = offsetMinutes - localOffsetMinutes;
  const hour = Number(parts.hour);
  const period = getDayPeriod(hour);

  return {
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    date: `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year}`,
    offset: formatOffset(offsetMinutes),
    localDifference: formatLocalDifference(difference),
    period: period.label,
    periodIcon: period.icon,
  };
}

function getTimeZoneParts(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const values: Record<string, string> = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });

  return {
    weekday: values.weekday ?? '',
    year: values.year ?? '',
    month: values.month ?? '',
    day: values.day ?? '',
    hour: values.hour ?? '00',
    minute: values.minute ?? '00',
    second: values.second ?? '00',
  };
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = getTimeZoneParts(timeZone, date);
  const asUtc = Date.UTC(
    Number(parts.year),
    monthIndex(parts.month),
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function monthIndex(month: string) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
}

function formatOffset(minutes: number) {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  return `GMT${sign}${String(hours).padStart(2, '0')}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`;
}

function formatLocalDifference(minutes: number) {
  if (minutes === 0) return 'same as local';
  const sign = minutes > 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  return `${sign}${hours}${mins ? `h ${mins}m` : 'h'} vs local`;
}

function getDayPeriod(hour: number) {
  if (hour >= 5 && hour < 12) return { label: 'Morning', icon: 'sun' };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon', icon: 'sun' };
  if (hour >= 17 && hour < 22) return { label: 'Evening', icon: 'moon' };
  return { label: 'Night', icon: 'moon' };
}

function loadSelectedCityIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return DEFAULT_CITY_IDS;
    const valid = parsed.filter((id): id is string => typeof id === 'string' && cityMap.has(id));
    return valid.length > 0 ? valid : DEFAULT_CITY_IDS;
  } catch {
    return DEFAULT_CITY_IDS;
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
