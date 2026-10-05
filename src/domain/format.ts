const NBSP = ' ';
const MINUS = '−';

/** 13528 → «13 528», −13528 → «−13 528» */
export function num(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return v < 0 ? MINUS + abs : abs;
}

/** «−13 528 смн» */
export function money(n: number): string {
  return `${num(n)}${NBSP}смн`;
}

/** «+4 556 смн» для изменений */
export function signedMoney(n: number): string {
  return n > 0 ? `+${money(n)}` : money(n);
}

/** Разбор суммы из поля ввода: только цифры, целое. */
export function parseAmount(s: string): number {
  const digits = s.replace(/\D/g, '').slice(0, 9);
  return digits ? Number(digits) : 0;
}

/** Разбор суммы, которая может быть отрицательной (остаток счёта). */
export function parseSigned(s: string): number {
  const neg = /^\s*[-−]/.test(s);
  const v = parseAmount(s);
  return neg ? -v : v;
}

export function percent(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** «1 трата», «2 траты», «5 трат» */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
