import { useEffect, useId, useState, type ReactNode } from 'react';
import { Banknote, CreditCard } from 'lucide-react';
import { dayMonth, todayYmd, yesterdayYmd } from '../domain/dates';
import { money, num, parseAmount, parseSigned } from '../domain/format';
import type { Payment } from '../domain/types';
import { Sheet } from './Sheet';

export function Money({ value, className = '', signed }: { value: number; className?: string; signed?: boolean }) {
  return <span className={`num whitespace-nowrap ${className}`}>{signed && value > 0 ? '+' : ''}{money(value)}</span>;
}

/** Полоса заполнения. ratio > 1 — перерасход. */
export function Bar({ ratio, tone, height = 6, label }: { ratio: number; tone?: 'ok' | 'warn' | 'over' | 'ink'; height?: number; label?: string }) {
  const t = tone ?? (ratio > 1 ? 'over' : ratio >= 0.85 ? 'warn' : 'ok');
  const color = { ok: 'bg-ok', warn: 'bg-warn', over: 'bg-over', ink: 'bg-ink' }[t];
  const w = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-track"
      style={{ height }}
      role="img"
      aria-label={label ?? `Заполнено на ${Math.round(ratio * 100)}%`}
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function toneOf(spent: number, limit: number): 'ok' | 'warn' | 'over' {
  if (spent > limit) return 'over';
  if (limit > 0 && spent / limit >= 0.85) return 'warn';
  return 'ok';
}

export const toneText = { ok: 'text-ok', warn: 'text-warn-ink', over: 'text-over' } as const;

/** Поле для суммы с системной цифровой клавиатурой. */
export function AmountField({
  value,
  onChange,
  label,
  allowNegative,
  id,
  hint,
  showZero,
}: {
  value: number | undefined;
  /** empty — поле очищено */
  onChange: (v: number, empty: boolean) => void;
  label: string;
  allowNegative?: boolean;
  id?: string;
  hint?: ReactNode;
  /** показывать 0 (иначе ноль = пустое поле) */
  showZero?: boolean;
}) {
  const show = (v: number | undefined) => (v === undefined || (v === 0 && !showZero) ? '' : num(v).replace(/\u00A0/g, ' '));
  const parse = (t: string) => (allowNegative ? parseSigned(t) : parseAmount(t));
  const [text, setText] = useState(() => show(value));
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  // Значение поменяли снаружи — показать его.
  useEffect(() => {
    setText((t) => (value !== undefined && parse(t) === value && t.trim() !== '' ? t : show(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={inputId}
          aria-describedby={hint ? hintId : undefined}
          className="field num pr-12 text-[17px]"
          inputMode={allowNegative ? 'text' : 'numeric'}
          pattern={allowNegative ? undefined : '[0-9 ]*'}
          autoComplete="off"
          value={text}
          placeholder="0"
          onChange={(e) => {
            const raw = e.target.value.replace(allowNegative ? /[^\d\s−-]/g : /[^\d\s]/g, '');
            setText(raw);
            onChange(parse(raw), raw.trim() === '' || raw.trim() === '-' || raw.trim() === '−');
          }}
          onBlur={() => setText(show(value))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true">
          смн
        </span>
      </div>
      {hint && (
        <span id={hintId} className="mt-1 block text-sm text-soft">
          {hint}
        </span>
      )}
    </div>
  );
}

/** «Сегодня / Вчера / Выбрать». Нативный календарь открывается прозрачным полем поверх кнопки. */
export function DateChips({ value, onChange, min, max }: { value: string; onChange: (d: string) => void; min?: string; max?: string }) {
  const today = todayYmd();
  const yesterday = yesterdayYmd();
  const custom = value !== today && value !== yesterday;
  return (
    <div className="flex gap-1.5" role="group" aria-label="Дата">
      <button type="button" className="chip flex-1" aria-pressed={value === today} onClick={() => onChange(today)}>
        Сегодня
      </button>
      <button type="button" className="chip flex-1" aria-pressed={value === yesterday} onClick={() => onChange(yesterday)}>
        Вчера
      </button>
      <div className="relative flex-1">
        <div className="chip pointer-events-none w-full" aria-hidden="true" data-pressed={custom} style={custom ? { background: '#16252C', color: '#fff', borderColor: '#16252C' } : undefined}>
          {custom ? dayMonth(value) : 'Выбрать'}
        </div>
        <input
          type="date"
          aria-label={custom ? `Дата: ${dayMonth(value)}. Выбрать другую` : 'Выбрать дату'}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={value}
          min={min}
          max={max}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function PaymentToggle({ value, onChange }: { value: Payment; onChange: (p: Payment) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Способ оплаты">
      <button type="button" className="chip flex-1 gap-2" aria-pressed={value === 'cash'} onClick={() => onChange('cash')}>
        <Banknote size={18} aria-hidden="true" /> Наличка
      </button>
      <button type="button" className="chip flex-1 gap-2" aria-pressed={value === 'card'} onClick={() => onChange('card')}>
        <CreditCard size={18} aria-hidden="true" /> Карта
      </button>
    </div>
  );
}

export function Confirm({
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-quiet flex-1" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="pb-2 text-[15px] leading-relaxed text-ink">{children}</div>
    </Sheet>
  );
}

/** Строка «подпись … сумма» */
export function Row({ label, children, sub, strong }: { label: ReactNode; children: ReactNode; sub?: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className={strong ? 'font-semibold' : ''}>{label}</div>
        {sub && <div className="text-sm text-soft">{sub}</div>}
      </div>
      <div className={`shrink-0 text-right ${strong ? 'font-semibold' : ''}`}>{children}</div>
    </div>
  );
}
