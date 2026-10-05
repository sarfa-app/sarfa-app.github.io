import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Открытые шиты по порядку: Escape и ловушка фокуса работают только у верхнего. */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Видимая область с учётом экранной клавиатуры iOS. */
export function useVisualViewport() {
  const read = () => {
    const vv = window.visualViewport;
    return vv ? { height: vv.height, top: vv.offsetTop } : { height: window.innerHeight, top: 0 };
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    const on = () => setV(read());
    vv?.addEventListener('resize', on);
    vv?.addEventListener('scroll', on);
    window.addEventListener('resize', on);
    return () => {
      vv?.removeEventListener('resize', on);
      vv?.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  return v;
}

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** full — во всю высоту видимой области (форма траты), auto — по содержимому */
  size?: 'full' | 'auto';
  /** закреплённый низ (кнопка подтверждения) */
  footer?: ReactNode;
  /** скрыть заголовок визуально (остаётся для экранного диктора) */
  hideTitle?: boolean;
  initialFocus?: string;
}

export function Sheet({ title, onClose, children, size = 'auto', footer, hideTitle, initialFocus }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const me = useRef(Symbol('sheet'));
  const vv = useVisualViewport();
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Регистрация в стеке, возврат фокуса, блокировка прокрутки страницы.
  useLayoutEffect(() => {
    const token = me.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    stack.push(token);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = ref.current;
    const target = (initialFocus && el?.querySelector<HTMLElement>(initialFocus)) || el;
    target?.focus({ preventScroll: true });
    return () => {
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null || n === document.activeElement,
        );
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!ref.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // Свайп вниз за шапку закрывает шит.
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStart.current = { y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDrag(Math.max(0, e.clientY - dragStart.current.y));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const v = dy / Math.max(1, Date.now() - dragStart.current.t);
    dragStart.current = null;
    setDrag(0);
    if (dy > 90 || (dy > 30 && v > 0.6)) closeRef.current();
  };

  const full = size === 'full';
  const style: React.CSSProperties = {
    top: vv.top,
    height: vv.height,
  };

  return createPortal(
    <div className="fixed inset-x-0 z-40 flex flex-col justify-end" style={style}>
      <div className="anim-fade absolute inset-0 bg-[#16252C]/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`anim-sheet relative mx-auto flex w-full max-w-[560px] flex-col rounded-t-2xl bg-card shadow-[0_-8px_30px_rgba(22,37,44,0.18)] ${
          full ? 'h-full' : 'max-h-[92%]'
        }`}
        style={{
          transform: drag ? `translateY(${drag}px)` : undefined,
          transition: drag ? 'none' : undefined,
          paddingTop: full && vv.top === 0 ? 'var(--safe-top)' : undefined,
        }}
      >
        <div
          className="flex shrink-0 touch-none select-none items-center gap-2 px-4 pb-1 pt-2"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-rule" aria-hidden="true" />
          <h2 id={titleId} className={hideTitle ? 'sr-only' : 'flex-1 pt-2 text-[17px] font-semibold leading-tight'}>
            {title}
          </h2>
          {hideTitle && <div className="flex-1" />}
          <button type="button" onClick={onClose} className="tap -mr-2 flex items-center justify-center rounded-full text-soft" aria-label="Закрыть">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 px-4 ${full ? 'flex flex-col overflow-hidden' : 'overflow-y-auto pb-4'}`}>{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-rule bg-card px-4 pt-3" style={{ paddingBottom: vv.height < window.innerHeight - 80 ? 12 : 'calc(var(--safe-bottom) + 12px)' }}>
            {footer}
          </div>
        )}
        {!footer && !full && <div className="shrink-0" style={{ height: 'var(--safe-bottom)' }} />}
      </div>
    </div>,
    document.body,
  );
}
