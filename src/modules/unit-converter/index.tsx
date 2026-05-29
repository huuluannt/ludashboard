import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';

type ConverterCategoryId =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'area'
  | 'volume'
  | 'speed'
  | 'time'
  | 'data'
  | 'pressure'
  | 'energy'
  | 'power';

interface UnitDefinition {
  id: string;
  label: string;
  symbol: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
}

interface ConverterCategory {
  id: ConverterCategoryId;
  label: string;
  icon: string;
  baseLabel: string;
  units: UnitDefinition[];
}

const linearUnit = (id: string, label: string, symbol: string, factorToBase: number): UnitDefinition => ({
  id,
  label,
  symbol,
  toBase: (value) => value * factorToBase,
  fromBase: (value) => value / factorToBase,
});

const temperatureUnit = (
  id: string,
  label: string,
  symbol: string,
  toCelsius: (value: number) => number,
  fromCelsius: (value: number) => number,
): UnitDefinition => ({
  id,
  label,
  symbol,
  toBase: toCelsius,
  fromBase: fromCelsius,
});

const CATEGORIES: ConverterCategory[] = [
  {
    id: 'length',
    label: 'Length',
    icon: 'ruler',
    baseLabel: 'meter',
    units: [
      linearUnit('meter', 'Meter', 'm', 1),
      linearUnit('kilometer', 'Kilometer', 'km', 1000),
      linearUnit('centimeter', 'Centimeter', 'cm', 0.01),
      linearUnit('millimeter', 'Millimeter', 'mm', 0.001),
      linearUnit('micrometer', 'Micrometer', 'um', 1e-6),
      linearUnit('nanometer', 'Nanometer', 'nm', 1e-9),
      linearUnit('inch', 'Inch', 'in', 0.0254),
      linearUnit('foot', 'Foot', 'ft', 0.3048),
      linearUnit('yard', 'Yard', 'yd', 0.9144),
      linearUnit('mile', 'Mile', 'mi', 1609.344),
      linearUnit('nautical-mile', 'Nautical mile', 'nmi', 1852),
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    icon: 'package',
    baseLabel: 'kilogram',
    units: [
      linearUnit('kilogram', 'Kilogram', 'kg', 1),
      linearUnit('gram', 'Gram', 'g', 0.001),
      linearUnit('milligram', 'Milligram', 'mg', 1e-6),
      linearUnit('metric-ton', 'Metric ton', 't', 1000),
      linearUnit('pound', 'Pound', 'lb', 0.45359237),
      linearUnit('ounce', 'Ounce', 'oz', 0.028349523125),
      linearUnit('stone', 'Stone', 'st', 6.35029318),
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    icon: 'sun',
    baseLabel: 'celsius',
    units: [
      temperatureUnit('celsius', 'Celsius', 'C', (value) => value, (value) => value),
      temperatureUnit('fahrenheit', 'Fahrenheit', 'F', (value) => (value - 32) * (5 / 9), (value) => value * (9 / 5) + 32),
      temperatureUnit('kelvin', 'Kelvin', 'K', (value) => value - 273.15, (value) => value + 273.15),
      temperatureUnit('rankine', 'Rankine', 'R', (value) => (value - 491.67) * (5 / 9), (value) => (value + 273.15) * (9 / 5)),
    ],
  },
  {
    id: 'area',
    label: 'Area',
    icon: 'layout-panel-top',
    baseLabel: 'square meter',
    units: [
      linearUnit('square-meter', 'Square meter', 'm2', 1),
      linearUnit('square-kilometer', 'Square kilometer', 'km2', 1_000_000),
      linearUnit('square-centimeter', 'Square centimeter', 'cm2', 0.0001),
      linearUnit('hectare', 'Hectare', 'ha', 10_000),
      linearUnit('acre', 'Acre', 'ac', 4046.8564224),
      linearUnit('square-foot', 'Square foot', 'ft2', 0.09290304),
      linearUnit('square-inch', 'Square inch', 'in2', 0.00064516),
      linearUnit('square-mile', 'Square mile', 'mi2', 2_589_988.110336),
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    icon: 'waves',
    baseLabel: 'liter',
    units: [
      linearUnit('liter', 'Liter', 'L', 1),
      linearUnit('milliliter', 'Milliliter', 'mL', 0.001),
      linearUnit('cubic-meter', 'Cubic meter', 'm3', 1000),
      linearUnit('gallon-us', 'US gallon', 'gal', 3.785411784),
      linearUnit('quart-us', 'US quart', 'qt', 0.946352946),
      linearUnit('pint-us', 'US pint', 'pt', 0.473176473),
      linearUnit('cup-us', 'US cup', 'cup', 0.2365882365),
      linearUnit('fluid-ounce-us', 'US fluid ounce', 'fl oz', 0.0295735295625),
      linearUnit('tablespoon-us', 'US tablespoon', 'tbsp', 0.01478676478125),
      linearUnit('teaspoon-us', 'US teaspoon', 'tsp', 0.00492892159375),
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    icon: 'navigation',
    baseLabel: 'meter per second',
    units: [
      linearUnit('meter-per-second', 'Meter per second', 'm/s', 1),
      linearUnit('kilometer-per-hour', 'Kilometer per hour', 'km/h', 1 / 3.6),
      linearUnit('mile-per-hour', 'Mile per hour', 'mph', 0.44704),
      linearUnit('knot', 'Knot', 'kn', 0.514444444444),
      linearUnit('foot-per-second', 'Foot per second', 'ft/s', 0.3048),
    ],
  },
  {
    id: 'time',
    label: 'Time',
    icon: 'clock',
    baseLabel: 'second',
    units: [
      linearUnit('second', 'Second', 's', 1),
      linearUnit('millisecond', 'Millisecond', 'ms', 0.001),
      linearUnit('minute', 'Minute', 'min', 60),
      linearUnit('hour', 'Hour', 'h', 3600),
      linearUnit('day', 'Day', 'd', 86_400),
      linearUnit('week', 'Week', 'wk', 604_800),
      linearUnit('month', 'Month, average', 'mo', 2_629_746),
      linearUnit('year', 'Year, average', 'yr', 31_556_952),
    ],
  },
  {
    id: 'data',
    label: 'Data',
    icon: 'database',
    baseLabel: 'byte',
    units: [
      linearUnit('byte', 'Byte', 'B', 1),
      linearUnit('kilobyte', 'Kilobyte', 'KB', 1000),
      linearUnit('megabyte', 'Megabyte', 'MB', 1_000_000),
      linearUnit('gigabyte', 'Gigabyte', 'GB', 1_000_000_000),
      linearUnit('terabyte', 'Terabyte', 'TB', 1_000_000_000_000),
      linearUnit('kibibyte', 'Kibibyte', 'KiB', 1024),
      linearUnit('mebibyte', 'Mebibyte', 'MiB', 1_048_576),
      linearUnit('gibibyte', 'Gibibyte', 'GiB', 1_073_741_824),
      linearUnit('tebibyte', 'Tebibyte', 'TiB', 1_099_511_627_776),
      linearUnit('bit', 'Bit', 'bit', 0.125),
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    icon: 'compass',
    baseLabel: 'pascal',
    units: [
      linearUnit('pascal', 'Pascal', 'Pa', 1),
      linearUnit('kilopascal', 'Kilopascal', 'kPa', 1000),
      linearUnit('bar', 'Bar', 'bar', 100_000),
      linearUnit('atmosphere', 'Atmosphere', 'atm', 101_325),
      linearUnit('psi', 'Pound per square inch', 'psi', 6894.757293168),
      linearUnit('torr', 'Torr', 'Torr', 133.3223684211),
    ],
  },
  {
    id: 'energy',
    label: 'Energy',
    icon: 'zap',
    baseLabel: 'joule',
    units: [
      linearUnit('joule', 'Joule', 'J', 1),
      linearUnit('kilojoule', 'Kilojoule', 'kJ', 1000),
      linearUnit('calorie', 'Calorie', 'cal', 4.184),
      linearUnit('kilocalorie', 'Kilocalorie', 'kcal', 4184),
      linearUnit('watt-hour', 'Watt hour', 'Wh', 3600),
      linearUnit('kilowatt-hour', 'Kilowatt hour', 'kWh', 3_600_000),
      linearUnit('btu', 'BTU', 'BTU', 1055.05585262),
    ],
  },
  {
    id: 'power',
    label: 'Power',
    icon: 'cpu',
    baseLabel: 'watt',
    units: [
      linearUnit('watt', 'Watt', 'W', 1),
      linearUnit('kilowatt', 'Kilowatt', 'kW', 1000),
      linearUnit('megawatt', 'Megawatt', 'MW', 1_000_000),
      linearUnit('horsepower', 'Horsepower', 'hp', 745.6998715823),
      linearUnit('btu-per-hour', 'BTU per hour', 'BTU/h', 0.2930710702),
    ],
  },
];

const categoryMap = new Map(CATEGORIES.map((category) => [category.id, category]));

export default function UnitConverterModule() {
  const [categoryId, setCategoryId] = useState<ConverterCategoryId>('length');
  const [inputValue, setInputValue] = useState('1');
  const [fromUnitId, setFromUnitId] = useState('meter');
  const [toUnitId, setToUnitId] = useState('kilometer');
  const [copied, setCopied] = useState(false);

  const activeCategory = categoryMap.get(categoryId) ?? CATEGORIES[0];
  const fromUnit = activeCategory.units.find((unit) => unit.id === fromUnitId) ?? activeCategory.units[0];
  const toUnit = activeCategory.units.find((unit) => unit.id === toUnitId) ?? activeCategory.units[1] ?? activeCategory.units[0];
  const numericValue = parseInputNumber(inputValue);

  const convertedValue = useMemo(() => {
    if (numericValue == null) return null;
    return toUnit.fromBase(fromUnit.toBase(numericValue));
  }, [fromUnit, numericValue, toUnit]);

  const allResults = useMemo(() => {
    if (numericValue == null) return [];
    const baseValue = fromUnit.toBase(numericValue);
    return activeCategory.units.map((unit) => ({
      unit,
      value: unit.fromBase(baseValue),
    }));
  }, [activeCategory.units, fromUnit, numericValue]);

  const changeCategory = (nextId: ConverterCategoryId) => {
    const nextCategory = categoryMap.get(nextId) ?? CATEGORIES[0];
    setCategoryId(nextId);
    setFromUnitId(nextCategory.units[0].id);
    setToUnitId((nextCategory.units[1] ?? nextCategory.units[0]).id);
    setCopied(false);
  };

  const swapUnits = () => {
    setFromUnitId(toUnit.id);
    setToUnitId(fromUnit.id);
    setCopied(false);
  };

  const copyResult = async () => {
    if (numericValue == null || convertedValue == null) return;
    const text = `${inputValue.trim()} ${fromUnit.symbol} = ${formatNumber(convertedValue)} ${toUnit.symbol}`;
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1100);
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[190px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="ruler" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Unit Converter</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {CATEGORIES.length} categories | offline
            </p>
          </div>
        </div>

        <select
          value={categoryId}
          onChange={(event) => changeCategory(event.target.value as ConverterCategoryId)}
          className="h-8 min-w-[150px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white"
        >
          {CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={swapUnits}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          title="Swap units"
          aria-label="Swap units"
        >
          <Icon name="rotate-cw" size={14} />
        </button>

        <button
          type="button"
          onClick={() => void copyResult()}
          disabled={convertedValue == null}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name="copy" size={13} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-[var(--color-surface-muted)] p-3 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section className="flex min-h-0 flex-col gap-3">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
            <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Convert</p>
            </div>

            <div className="space-y-3 p-4">
              <UnitInputBlock
                label="From"
                value={inputValue}
                unitId={fromUnit.id}
                units={activeCategory.units}
                onValueChange={(value) => {
                  setInputValue(value);
                  setCopied(false);
                }}
                onUnitChange={(id) => {
                  setFromUnitId(id);
                  setCopied(false);
                }}
              />

              <button
                type="button"
                onClick={swapUnits}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                title="Swap units"
                aria-label="Swap units"
              >
                <Icon name="rotate-cw" size={14} />
              </button>

              <ResultBlock
                label="To"
                value={convertedValue}
                unitId={toUnit.id}
                units={activeCategory.units}
                onUnitChange={(id) => {
                  setToUnitId(id);
                  setCopied(false);
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <Icon name={activeCategory.icon} size={15} />
              <span className="font-semibold">{activeCategory.label}</span>
              <span className="text-[var(--color-text-tertiary)]">base: {activeCategory.baseLabel}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => changeCategory(category.id)}
                  className={`flex h-9 min-w-0 items-center gap-2 rounded-xl px-2 text-left text-xs font-medium transition-colors ${
                    category.id === categoryId
                      ? 'bg-[var(--color-text-primary)] text-white'
                      : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  <Icon name={category.icon} size={14} />
                  <span className="truncate">{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">All units</p>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">{activeCategory.units.length} results</span>
          </div>

          <div className="grid max-h-full min-h-0 gap-2 overflow-y-auto p-3 md:grid-cols-2 2xl:grid-cols-3">
            {numericValue == null ? (
              <div className="col-span-full flex min-h-[220px] items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-tertiary)]">
                    <Icon name="ruler" size={22} />
                  </div>
                  <p className="text-sm font-semibold">Enter a number</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Use decimal values like 12.5 or -40.</p>
                </div>
              </div>
            ) : (
              allResults.map(({ unit, value }) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setToUnitId(unit.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    unit.id === toUnit.id
                      ? 'border-[var(--color-accent)] bg-blue-50'
                      : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-accent)] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">{unit.label}</span>
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                      {unit.symbol}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-[var(--color-text-primary)]">
                    {formatNumber(value)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function UnitInputBlock({
  label,
  value,
  unitId,
  units,
  onValueChange,
  onUnitChange,
}: {
  label: string;
  value: string;
  unitId: string;
  units: UnitDefinition[];
  onValueChange: (value: string) => void;
  onUnitChange: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</span>
        <UnitSelect value={unitId} units={units} onChange={onUnitChange} />
      </div>
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        inputMode="decimal"
        className="h-12 w-full rounded-lg border border-transparent bg-white px-3 text-xl font-semibold outline-none transition-colors focus:border-[var(--color-accent)]"
        placeholder="0"
      />
    </div>
  );
}

function ResultBlock({
  label,
  value,
  unitId,
  units,
  onUnitChange,
}: {
  label: string;
  value: number | null;
  unitId: string;
  units: UnitDefinition[];
  onUnitChange: (id: string) => void;
}) {
  const unit = units.find((item) => item.id === unitId) ?? units[0];
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</span>
        <UnitSelect value={unitId} units={units} onChange={onUnitChange} />
      </div>
      <div className="flex min-h-12 items-center rounded-lg bg-white px-3">
        <span className="break-all text-xl font-semibold text-[var(--color-text-primary)]">
          {value == null ? 'Invalid number' : formatNumber(value)}
        </span>
        <span className="ml-2 text-xs font-semibold text-[var(--color-text-tertiary)]">{unit.symbol}</span>
      </div>
    </div>
  );
}

function UnitSelect({
  value,
  units,
  onChange,
}: {
  value: string;
  units: UnitDefinition[];
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 max-w-[180px] rounded-lg border border-[var(--color-border-subtle)] bg-white px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)]"
    >
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.label} ({unit.symbol})
        </option>
      ))}
    </select>
  );
}

function parseInputNumber(value: string) {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return 'Invalid';
  if (Object.is(value, -0)) return '0';
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-7)) {
    return value.toExponential(6).replace(/\.?0+e/, 'e');
  }

  const maximumFractionDigits = absolute >= 1000 ? 4 : absolute >= 1 ? 8 : 10;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(Number(value.toPrecision(12)));
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
