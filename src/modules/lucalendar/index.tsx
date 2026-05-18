import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarAccounts,
  fetchCalendarEvents,
  fetchCalendars,
  removeCalendarAccount,
  startCalendarConnection,
} from './calendarApi';
import {
  addMonths,
  formatDayTitle,
  formatEventTime,
  formatMonthLabel,
  getDefaultEventTimes,
  getGridRange,
  getVisibleMonthDays,
  mapEventsByDay,
  parseDateKey,
  startOfMonth,
  toDateKey,
} from './dateUtils';
import type { CalendarAccount, CalendarInfo, LuCalendarEvent } from './types';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function LuCalendarModule() {
  const [dashboardUser, setDashboardUser] = useState<User | null>(() => getAuth(app).currentUser);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [calendarsByAccount, setCalendarsByAccount] = useState<Record<string, CalendarInfo[]>>({});
  const [events, setEvents] = useState<LuCalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [accountFilter, setAccountFilter] = useState('all');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const visibleDays = useMemo(() => getVisibleMonthDays(currentMonth), [currentMonth]);
  const eventsByDay = useMemo(() => mapEventsByDay(events), [events]);
  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);
  const selectedEvents = eventsByDay.get(selectedDateKey) || [];
  const reconnectAccounts = accounts.filter((account) => account.needsReconnect);

  const loadAccounts = useCallback(async () => {
    if (!getAuth(app).currentUser) return;
    setLoadingAccounts(true);
    setError('');
    try {
      const { accounts: nextAccounts } = await fetchCalendarAccounts();
      setAccounts(nextAccounts);
      setAccountFilter((current) => {
        if (current === 'all' || nextAccounts.some((account) => account.accountId === current)) return current;
        return 'all';
      });

      const calendarPairs = await Promise.all(
        nextAccounts.map(async (account) => {
          if (account.needsReconnect) return [account.accountId, []] as const;
          try {
            const { calendars } = await fetchCalendars(account.accountId);
            return [account.accountId, calendars] as const;
          } catch {
            return [account.accountId, []] as const;
          }
        }),
      );
      setCalendarsByAccount(Object.fromEntries(calendarPairs));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load LuCalendar accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    if (!getAuth(app).currentUser || accounts.length === 0) return;
    const { timeMin, timeMax } = getGridRange(visibleDays);
    setLoadingEvents(true);
    setError('');
    try {
      const { events: nextEvents, errors } = await fetchCalendarEvents(timeMin, timeMax, accountFilter);
      setEvents(nextEvents);
      if (errors?.length) {
        setStatus(errors.map((item) => `${item.email}: ${item.error}`).join(' | '));
      } else {
        setStatus('');
      }
    } catch (eventsError) {
      setError(eventsError instanceof Error ? eventsError.message : 'Unable to load events.');
    } finally {
      setLoadingEvents(false);
    }
  }, [accountFilter, accounts.length, visibleDays]);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (user) => {
      setDashboardUser(user);
      if (user) void loadAccounts();
    });
  }, [loadAccounts]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ludashboard-calendar-connected') {
        setConnecting(false);
        setStatus('Google Calendar account connected.');
        void loadAccounts();
      }
      if (event.data?.type === 'ludashboard-calendar-error') {
        setConnecting(false);
        setError('Google Calendar connection failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAccounts]);

  const connectAccount = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await startCalendarConnection();
      const popup = window.open(authUrl, 'lucalendar-google-oauth', 'width=520,height=720');
      if (!popup) {
        setConnecting(false);
        setError('Popup was blocked. Allow popups and try again.');
        return;
      }

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          setConnecting(false);
          void loadAccounts();
        }
      }, 900);
    } catch (connectError) {
      setConnecting(false);
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect Google Calendar.');
    }
  };

  const deleteEvent = async (event: LuCalendarEvent) => {
    if (!window.confirm(`Delete "${event.title}" from ${event.accountEmail}?`)) return;
    const previous = events;
    setEvents((current) => current.filter((item) => !(item.id === event.id && item.calendarId === event.calendarId && item.accountId === event.accountId)));
    try {
      await deleteCalendarEvent(event);
      setStatus('Event deleted.');
    } catch (deleteError) {
      setEvents(previous);
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete event.');
    }
  };

  const removeSelectedAccount = async () => {
    const account = accounts.find((item) => item.accountId === accountFilter);
    if (!account) return;
    if (!window.confirm(`Remove ${account.email} from LuCalendar? Events will stay in Google Calendar.`)) return;
    await removeCalendarAccount(account.accountId);
    setAccounts((current) => current.filter((item) => item.accountId !== account.accountId));
    setCalendarsByAccount((current) => {
      const next = { ...current };
      delete next[account.accountId];
      return next;
    });
    setAccountFilter('all');
    setEvents((current) => current.filter((event) => event.accountId !== account.accountId));
  };

  const addCreatedEvent = (event: LuCalendarEvent) => {
    const calendars = calendarsByAccount[event.accountId] || [];
    const calendar = calendars.find((item) => item.id === event.calendarId);
    setEvents((current) => [
      ...current,
      {
        ...event,
        calendarSummary: calendar?.summary || event.calendarSummary,
        color: calendar?.backgroundColor || event.color,
      },
    ]);
    setShowAddForm(false);
    setStatus('Event created.');
  };

  if (!dashboardUser) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="calendar" size={26} />
          </div>
          <h2 className="text-lg font-semibold">Sign in to use LuCalendar</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            LuCalendar has its own Google Calendar connection, but the LuDashboard session protects its server APIs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="calendar" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuCalendar</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {accounts.length ? `${accounts.length} Google Calendar accounts` : 'Month view'}
            </p>
          </div>
        </div>

        <select
          value={accountFilter}
          onChange={(event) => setAccountFilter(event.target.value)}
          className="h-8 min-w-[190px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white"
        >
          <option value="all">All connected calendars</option>
          {accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.email}{account.needsReconnect ? ' (Reconnect account)' : ''}
            </option>
          ))}
        </select>

        {accountFilter !== 'all' && (
          <button
            type="button"
            onClick={removeSelectedAccount}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]"
          >
            <Icon name="trash" size={13} />
            Remove
          </button>
        )}

        <div className="flex items-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-0.5">
          <button type="button" onClick={() => setCurrentMonth((date) => addMonths(date, -1))} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-white">
            <Icon name="chevron-left" size={14} />
          </button>
          <button type="button" onClick={() => {
            const today = new Date();
            setCurrentMonth(startOfMonth(today));
            setSelectedDateKey(toDateKey(today));
          }} className="h-7 rounded-md px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-white">
            Today
          </button>
          <button type="button" onClick={() => setCurrentMonth((date) => addMonths(date, 1))} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-white">
            <Icon name="chevron-right" size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={connectAccount}
          disabled={connecting}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="plus" size={13} />
          {connecting ? 'Connecting' : 'Connect account'}
        </button>
      </header>

      {(status || error) && (
        <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2">
          {status && <p className="text-xs text-[var(--color-text-secondary)]">{status}</p>}
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      )}

      {reconnectAccounts.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2">
          <p className="text-xs font-medium text-amber-800">
            Reconnect account: {reconnectAccounts.map((account) => account.email).join(', ')}
          </p>
          <button
            type="button"
            onClick={connectAccount}
            disabled={connecting}
            className="h-7 rounded-lg bg-white px-2 text-[11px] font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            Reconnect account
          </button>
        </div>
      )}

      {accounts.length === 0 && !loadingAccounts ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
              <Icon name="calendar" size={25} />
            </div>
            <h3 className="text-base font-semibold">Connect Google Calendar</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
              LuCalendar connects Google Calendar accounts separately from your LuDashboard login.
              You can connect multiple Gmail accounts and view them together.
            </p>
            <button
              type="button"
              onClick={connectAccount}
              disabled={connecting}
              className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              Connect Google Calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-w-0 flex-col p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">{formatMonthLabel(currentMonth)}</h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {loadingEvents ? 'Loading events...' : `${events.length} events in visible range`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm((value) => !value)}
                disabled={accounts.length === 0}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] shadow-sm transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
              >
                <Icon name="plus" size={13} />
                New event
              </button>
            </div>

            <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
              <div className="grid grid-cols-7 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid min-h-0 grid-cols-7" style={{ gridTemplateRows: `repeat(${Math.ceil(visibleDays.length / 7)}, minmax(0, 1fr))` }}>
                {visibleDays.map((day) => {
                  const dayEvents = eventsByDay.get(day.key) || [];
                  const selected = selectedDateKey === day.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(day.key);
                      }}
                      className={`min-h-0 border-b border-r border-[var(--color-border-subtle)] p-1.5 text-left transition-colors hover:bg-[var(--color-surface-subtle)] ${
                        selected ? 'bg-[var(--color-accent-subtle)] ring-1 ring-inset ring-[var(--color-accent)]/35' : 'bg-white'
                      } ${day.inMonth ? '' : 'text-[var(--color-text-tertiary)]'}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                            day.isToday ? 'bg-[var(--color-text-primary)] text-white' : day.inMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'
                          }`}
                        >
                          {day.date.getDate()}
                        </span>
                        {dayEvents.length > 2 && <span className="text-[9px] text-[var(--color-text-tertiary)]">+{dayEvents.length - 2}</span>}
                      </div>
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={`${event.accountId}:${event.calendarId}:${event.id}`}
                            className="block truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: event.color || '#4361ee' }}
                            title={`${event.title} - ${event.accountEmail}`}
                          >
                            {event.title}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-[var(--color-border-subtle)] bg-white p-3">
            <DayDetailsPanel
              date={selectedDate}
              events={selectedEvents}
              accounts={accounts}
              calendarsByAccount={calendarsByAccount}
              showAddForm={showAddForm}
              onToggleAdd={() => setShowAddForm((value) => !value)}
              onDeleteEvent={deleteEvent}
              onCreated={addCreatedEvent}
              accountFilter={accountFilter}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

interface DayDetailsPanelProps {
  date: Date;
  events: LuCalendarEvent[];
  accounts: CalendarAccount[];
  calendarsByAccount: Record<string, CalendarInfo[]>;
  showAddForm: boolean;
  accountFilter: string;
  onToggleAdd: () => void;
  onDeleteEvent: (event: LuCalendarEvent) => void;
  onCreated: (event: LuCalendarEvent) => void;
}

function DayDetailsPanel({
  date,
  events,
  accounts,
  calendarsByAccount,
  showAddForm,
  accountFilter,
  onToggleAdd,
  onDeleteEvent,
  onCreated,
}: DayDetailsPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name="calendar" size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{formatDayTitle(date)}</h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">{events.length} events</p>
        </div>
        <button type="button" onClick={onToggleAdd} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)]">
          <Icon name={showAddForm ? 'x' : 'plus'} size={15} />
        </button>
      </div>

      {showAddForm && (
        <AddEventForm
          dateKey={toDateKey(date)}
          accounts={accounts}
          calendarsByAccount={calendarsByAccount}
          accountFilter={accountFilter}
          onCreated={onCreated}
        />
      )}

      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-8 text-center">
            <Icon name="calendar" size={22} className="mx-auto text-[var(--color-text-tertiary)]" />
            <p className="mt-2 text-sm font-medium">No events</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Create an event or choose another day.</p>
          </div>
        ) : (
          events.map((event) => (
            <article key={`${event.accountId}:${event.calendarId}:${event.id}`} className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: event.color || '#4361ee' }} />
                <div className="min-w-0 flex-1">
                  <h4 className="break-words text-sm font-semibold">{event.title}</h4>
                  <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{formatEventTime(event)}</p>
                  <p className="mt-1 truncate text-[10px] text-[var(--color-text-tertiary)]">
                    {event.accountEmail} | {event.calendarSummary}
                  </p>
                  {event.description && <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--color-text-secondary)]">{event.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteEvent(event)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]"
                  title="Delete event"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

interface AddEventFormProps {
  dateKey: string;
  accounts: CalendarAccount[];
  calendarsByAccount: Record<string, CalendarInfo[]>;
  accountFilter: string;
  onCreated: (event: LuCalendarEvent) => void;
}

function AddEventForm({ dateKey, accounts, calendarsByAccount, accountFilter, onCreated }: AddEventFormProps) {
  const defaults = getDefaultEventTimes();
  const availableAccounts = accounts.filter((account) => !account.needsReconnect);
  const defaultAccountId =
    accountFilter !== 'all' && availableAccounts.some((account) => account.accountId === accountFilter)
      ? accountFilter
      : availableAccounts[0]?.accountId || '';
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateKey);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(defaultAccountId);
  const writableCalendars = getWritableCalendars(calendarsByAccount[accountId] || []);
  const [calendarId, setCalendarId] = useState(writableCalendars[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDate(dateKey);
  }, [dateKey]);

  useEffect(() => {
    const calendars = getWritableCalendars(calendarsByAccount[accountId] || []);
    if (!calendars.some((calendar) => calendar.id === calendarId)) {
      setCalendarId(calendars[0]?.id || '');
    }
  }, [accountId, calendarId, calendarsByAccount]);

  const submit = async () => {
    if (!title.trim() || !accountId || !calendarId) return;
    setSaving(true);
    setError('');
    try {
      const { event } = await createCalendarEvent({
        accountId,
        calendarId,
        title,
        date,
        startTime,
        endTime,
        description,
      });
      onCreated(event);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="plus" size={14} className="text-[var(--color-accent)]" />
        <h4 className="text-xs font-semibold">New event</h4>
      </div>

      <div className="space-y-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="h-9 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white" />
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white" />
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="h-9 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white" />
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="h-9 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white" />
        </div>
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="h-9 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white">
          {availableAccounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>{account.email}</option>
          ))}
        </select>
        <select value={calendarId} onChange={(event) => setCalendarId(event.target.value)} className="h-9 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white">
          {writableCalendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>{calendar.primary ? 'Primary - ' : ''}{calendar.summary}</option>
          ))}
        </select>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description optional" className="h-16 w-full resize-none rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-xs outline-none focus:border-[var(--color-accent)] focus:bg-white" />
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={saving || !title.trim() || !calendarId}
          className="h-9 w-full rounded-lg bg-[var(--color-text-primary)] text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? 'Saving...' : 'Create event'}
        </button>
      </div>
    </div>
  );
}

function getWritableCalendars(calendars: CalendarInfo[]) {
  return calendars.filter((calendar) => calendar.accessRole === 'owner' || calendar.accessRole === 'writer');
}
