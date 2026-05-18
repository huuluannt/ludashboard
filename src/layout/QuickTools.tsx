import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';

const GOOGLE_URL = 'https://www.google.com/';
const USD_VND_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const RATE_CACHE_KEY = 'ludashboard_usd_vnd_rate';
const RATE_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

type QuickTool = 'money' | 'calculator';

interface RateCache {
  rate: number;
  fetchedAt: number;
  nextUpdateAt?: number;
  updatedAtText?: string;
}

export default function QuickTools() {
  const [openTool, setOpenTool] = useState<QuickTool | null>(null);
  const [usdAmount, setUsdAmount] = useState('2');
  const [rateCache, setRateCache] = useState<RateCache | null>(() => loadStoredRate());
  const [rateStatus, setRateStatus] = useState('');
  const [formula, setFormula] = useState('20*10');
  const containerRef = useRef<HTMLDivElement>(null);
  const moneyInputRef = useRef<HTMLInputElement>(null);
  const calculatorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openTool) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenTool(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openTool]);

  useEffect(() => {
    if (openTool === 'money') {
      const timer = window.setTimeout(() => moneyInputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }

    if (openTool === 'calculator') {
      const timer = window.setTimeout(() => calculatorInputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [openTool]);

  useEffect(() => {
    if (openTool !== 'money') return;

    const cached = loadStoredRate();
    if (cached) setRateCache(cached);
    if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_MAX_AGE_MS) return;

    let cancelled = false;
    setRateStatus('Updating rate...');

    fetch(USD_VND_RATE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Rate request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const rate = Number(data?.rates?.VND);
        if (!Number.isFinite(rate) || rate <= 0 || data?.result === 'error') {
          throw new Error('USD to VND rate unavailable.');
        }

        const nextCache: RateCache = {
          rate,
          fetchedAt: Date.now(),
          nextUpdateAt: Number(data?.time_next_update_unix || 0) * 1000 || undefined,
          updatedAtText: typeof data?.time_last_update_utc === 'string' ? data.time_last_update_utc : undefined,
        };

        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(nextCache));
        if (!cancelled) {
          setRateCache(nextCache);
          setRateStatus('');
        }
      })
      .catch(() => {
        if (!cancelled) setRateStatus(cached ? 'Using cached rate' : 'Could not update rate');
      });

    return () => {
      cancelled = true;
    };
  }, [openTool]);

  const convertedAmount = useMemo(() => {
    const amount = Number(usdAmount);
    if (!rateCache || !Number.isFinite(amount)) return null;
    return amount * rateCache.rate;
  }, [rateCache, usdAmount]);

  const calculatorResult = useMemo(() => evaluateExpression(formula), [formula]);

  const setMoneyOpen = () => setOpenTool((tool) => (tool === 'money' ? null : 'money'));
  const setCalculatorOpen = () => setOpenTool((tool) => (tool === 'calculator' ? null : 'calculator'));

  return (
    <div className="relative flex flex-shrink-0 items-end pb-1" ref={containerRef}>
      <QuickToolButton
        active={false}
        icon="globe"
        label="Open Google"
        onClick={() => window.open(GOOGLE_URL, '_blank', 'noopener,noreferrer')}
      />
      <QuickToolButton active={openTool === 'money'} label="USD to VND" textIcon="$" onClick={setMoneyOpen} />
      <QuickToolButton active={openTool === 'calculator'} icon="calculator" label="Quick calculator" onClick={setCalculatorOpen} />

      {openTool === 'money' && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-[min(300px,calc(100vw-1rem))] rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-xl shadow-black/10">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
              $
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Money: USD to VND</p>
              <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">
                {rateCache ? `1 USD = ${formatVnd(rateCache.rate)} VND` : 'Fetching live rate...'}
              </p>
            </div>
          </div>

          <label className="relative block">
            <input
              ref={moneyInputRef}
              value={usdAmount}
              aria-label="USD amount"
              onChange={(event) => setUsdAmount(sanitizeMoney(event.currentTarget.value))}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
              className="h-11 w-full rounded-lg border border-black/35 bg-[var(--color-surface-subtle)] px-3 pr-9 text-right text-lg font-semibold outline-none transition-colors focus:border-black focus:bg-white"
              inputMode="decimal"
              placeholder="0"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--color-text-primary)]">$</span>
          </label>

          <div className="mt-3 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-3 text-right">
            <p className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {convertedAmount == null ? '--' : formatVnd(convertedAmount)} VND
            </p>
            <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[var(--color-text-tertiary)]">
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text-secondary)]">
                Rates by ExchangeRate-API
              </a>
              <span>{rateStatus || formatRateTime(rateCache)}</span>
            </div>
          </div>
        </div>
      )}

      {openTool === 'calculator' && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-[min(300px,calc(100vw-1rem))] rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-xl shadow-black/10">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
              <Icon name="calculator" size={15} />
            </div>
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-text-primary)]">Calculator</p>
            <button
              type="button"
              onClick={() => {
                setFormula('');
                calculatorInputRef.current?.focus();
              }}
              className="h-7 rounded-lg bg-[var(--color-text-primary)] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-black"
            >
              Clear
            </button>
          </div>

          <input
            ref={calculatorInputRef}
            value={formula}
            aria-label="Calculator expression"
            onChange={(event) => setFormula(sanitizeFormula(event.currentTarget.value))}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpenTool(null);
            }}
            className="h-11 w-full rounded-lg border border-black/35 bg-[var(--color-surface-subtle)] px-3 text-right text-lg font-semibold outline-none transition-colors focus:border-black focus:bg-white"
            inputMode="decimal"
            placeholder="20*10"
          />

          <div className="mt-3 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-3 text-right">
            <p className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {calculatorResult}
            </p>
            <p className="mt-1 text-[9px] text-[var(--color-text-tertiary)]">Allowed: numbers, +, -, *, /, ^, (, )</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface QuickToolButtonProps {
  active: boolean;
  icon?: string;
  label: string;
  textIcon?: string;
  onClick: () => void;
}

function QuickToolButton({ active, icon, label, textIcon, onClick }: QuickToolButtonProps) {
  return (
    <div className="flex-shrink-0 px-0.5">
      <button
        type="button"
        onClick={onClick}
        className={`
          flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[13px] font-semibold transition-colors
          ${
            active
              ? 'border border-[var(--color-border-subtle)] bg-white text-[var(--color-accent)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)]'
          }
        `}
        title={label}
        aria-label={label}
      >
        {icon ? <Icon name={icon} size={15} /> : textIcon}
      </button>
    </div>
  );
}

function sanitizeMoney(value: string) {
  const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const [first, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${first}.${rest.join('')}` : first;
}

function sanitizeFormula(value: string) {
  return value.replace(/[^0-9+\-*/^().\s]/g, '');
}

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRateTime(cache: RateCache | null) {
  if (!cache) return '';
  if (cache.updatedAtText) return 'Updated daily';
  return 'Cached rate';
}

function evaluateExpression(expression: string) {
  const source = expression.replace(/\s+/g, '');
  if (!source) return '--';

  try {
    const parser = new MathParser(source);
    const value = parser.parse();
    if (!Number.isFinite(value)) return 'Undefined';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value);
  } catch {
    return 'Invalid';
  }
}

class MathParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse() {
    const value = this.parseExpression();
    if (this.index !== this.source.length) throw new Error('Unexpected input');
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (this.match('+') || this.match('-')) {
      const operator = this.source[this.index - 1];
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parsePower();

    while (this.match('*') || this.match('/')) {
      const operator = this.source[this.index - 1];
      const right = this.parsePower();
      value = operator === '*' ? value * right : value / right;
    }

    return value;
  }

  private parsePower(): number {
    let value = this.parseUnary();

    if (this.match('^')) {
      value = value ** this.parsePower();
    }

    return value;
  }

  private parseUnary(): number {
    if (this.match('+')) return this.parseUnary();
    if (this.match('-')) return -this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    if (this.match('(')) {
      const value = this.parseExpression();
      if (!this.match(')')) throw new Error('Missing closing parenthesis');
      return value;
    }

    return this.parseNumber();
  }

  private parseNumber(): number {
    const start = this.index;

    while (this.index < this.source.length && /[0-9.]/.test(this.source[this.index])) {
      this.index += 1;
    }

    if (start === this.index) throw new Error('Expected number');

    const raw = this.source.slice(start, this.index);
    if ((raw.match(/\./g) || []).length > 1) throw new Error('Invalid number');

    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error('Invalid number');
    return value;
  }

  private match(token: string) {
    if (this.source[this.index] !== token) return false;
    this.index += 1;
    return true;
  }
}

function loadStoredRate(): RateCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || 'null') as RateCache | null;
    if (!parsed || !Number.isFinite(parsed.rate) || parsed.rate <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
