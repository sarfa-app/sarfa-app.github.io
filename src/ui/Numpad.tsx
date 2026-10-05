import { useRef } from 'react';
import { Delete } from 'lucide-react';

const MAX_DIGITS = 9;

/** Собственная цифровая клавиатура: ничего не прыгает и не нужен фокус в поле. */
/** fill — клавиши растягиваются по высоте контейнера (форма траты на маленьких экранах). */
export function Numpad({ value, onChange, compact, fill }: { value: string; onChange: (v: string) => void; compact?: boolean; fill?: boolean }) {
  const hold = useRef<ReturnType<typeof setTimeout>>();

  const press = (d: string) => {
    let next = (value === '0' ? '' : value) + d;
    next = next.replace(/^0+(?=\d)/, '');
    if (next.length > MAX_DIGITS) return;
    onChange(next);
  };
  const back = () => onChange(value.slice(0, -1));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'];
  const h = fill ? 'h-full min-h-[40px]' : compact ? 'h-11' : 'h-[52px]';

  return (
    <div className={`grid grid-cols-3 gap-1.5 ${fill ? 'h-full grid-rows-4' : ''}`} role="group" aria-label="Цифровая клавиатура">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          className={`${h} num rounded-lg bg-paper text-[22px] font-medium text-ink active:bg-rule`}
          onClick={() => press(k)}
          disabled={k === '00' && (value === '' || value === '0')}
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        className={`${h} flex items-center justify-center rounded-lg bg-paper text-ink active:bg-rule`}
        aria-label="Стереть цифру (удерживайте, чтобы очистить)"
        onClick={back}
        onPointerDown={() => {
          hold.current = setTimeout(() => onChange(''), 600);
        }}
        onPointerUp={() => clearTimeout(hold.current)}
        onPointerLeave={() => clearTimeout(hold.current)}
      >
        <Delete size={24} aria-hidden="true" />
      </button>
    </div>
  );
}
