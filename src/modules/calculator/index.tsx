import { useState, useCallback } from 'react';

export default function CalculatorModule() {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === '0' ? digit : display + digit);
      }
    },
    [display, waitingForOperand],
  );

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const toggleSign = useCallback(() => {
    const val = parseFloat(display);
    if (val !== 0) {
      setDisplay(String(-val));
    }
  }, [display]);

  const inputPercent = useCallback(() => {
    const val = parseFloat(display);
    setDisplay(String(val / 100));
  }, [display]);

  const performOperation = useCallback(
    (nextOp: string) => {
      const current = parseFloat(display);

      if (prevValue == null) {
        setPrevValue(current);
      } else if (operator) {
        const result = calculate(prevValue, current, operator);
        setPrevValue(result);
        setDisplay(String(result));
      }

      setOperator(nextOp);
      setWaitingForOperand(true);
    },
    [display, prevValue, operator],
  );

  const handleEquals = useCallback(() => {
    if (operator == null || prevValue == null) return;
    const current = parseFloat(display);
    const result = calculate(prevValue, current, operator);
    setDisplay(String(result));
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }, [display, prevValue, operator]);

  const buttons = [
    { label: 'AC', action: clearAll, className: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] font-medium' },
    { label: '+/−', action: toggleSign, className: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] font-medium' },
    { label: '%', action: inputPercent, className: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] font-medium' },
    { label: '÷', action: () => performOperation('/'), className: 'bg-[var(--color-accent)] text-white font-medium' },
    { label: '7', action: () => inputDigit('7') },
    { label: '8', action: () => inputDigit('8') },
    { label: '9', action: () => inputDigit('9') },
    { label: '×', action: () => performOperation('*'), className: 'bg-[var(--color-accent)] text-white font-medium' },
    { label: '4', action: () => inputDigit('4') },
    { label: '5', action: () => inputDigit('5') },
    { label: '6', action: () => inputDigit('6') },
    { label: '−', action: () => performOperation('-'), className: 'bg-[var(--color-accent)] text-white font-medium' },
    { label: '1', action: () => inputDigit('1') },
    { label: '2', action: () => inputDigit('2') },
    { label: '3', action: () => inputDigit('3') },
    { label: '+', action: () => performOperation('+'), className: 'bg-[var(--color-accent)] text-white font-medium' },
    { label: '0', action: () => inputDigit('0'), className: 'col-span-2' },
    { label: '.', action: inputDecimal },
    { label: '=', action: handleEquals, className: 'bg-[var(--color-accent)] text-white font-medium' },
  ];

  return (
    <div className="flex items-start justify-center h-full p-8">
      <div className="w-full max-w-[320px]">
        {/* Display */}
        <div className="bg-[var(--color-surface-subtle)] rounded-2xl p-6 mb-4 text-right border border-[var(--color-border-subtle)]">
          <div className="text-xs text-[var(--color-text-tertiary)] h-5 mb-1">
            {prevValue != null && operator
              ? `${prevValue} ${operatorSymbol(operator)}`
              : ''}
          </div>
          <div
            className="text-4xl font-light tracking-tight text-[var(--color-text-primary)] overflow-hidden"
            style={{ fontSize: display.length > 10 ? '1.5rem' : display.length > 7 ? '2rem' : '2.25rem' }}
          >
            {display}
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className={`
                h-14 rounded-xl text-lg font-normal
                transition-all duration-100
                hover:brightness-95 active:scale-95
                cursor-pointer
                ${btn.className || 'bg-white border border-[var(--color-border)] text-[var(--color-text-primary)]'}
              `}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function calculate(a: number, b: number, op: string): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : 0;
    default: return b;
  }
}

function operatorSymbol(op: string): string {
  switch (op) {
    case '+': return '+';
    case '-': return '−';
    case '*': return '×';
    case '/': return '÷';
    default: return '';
  }
}
