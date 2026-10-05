/** Работа с датами в локальном часовом поясе устройства, без библиотек. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayYmd(now = new Date()): string {
  return toYmd(now);
}

export function yesterdayYmd(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return toYmd(d);
}

export function ymOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function isYm(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function isYmd(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_PREP = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «Октябрь 2026» */
export function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_NOM[m - 1]} ${y}`;
}

/** «октябрь» */
export function monthName(ym: string): string {
  return MONTHS_NOM[Number(ym.slice(5, 7)) - 1].toLowerCase();
}

/** «в октябре» → «октябре» */
export function monthPrep(ym: string): string {
  return MONTHS_PREP[Number(ym.slice(5, 7)) - 1];
}

/** «октября» */
export function monthGen(ym: string): string {
  return MONTHS_GEN[Number(ym.slice(5, 7)) - 1];
}

/** «окт 2026» / «окт» */
export function monthShort(ym: string, withYear = true): string {
  const [y, m] = ym.split('-').map(Number);
  return withYear ? `${MONTHS_SHORT[m - 1]} ${y}` : MONTHS_SHORT[m - 1];
}

/** «15 сентября» */
export function dayMonth(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]}`;
}

/** «Сегодня», «Вчера» или «15 сентября, вт» */
export function dayLabel(ymd: string, now = new Date()): string {
  if (ymd === todayYmd(now)) return 'Сегодня';
  if (ymd === yesterdayYmd(now)) return 'Вчера';
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${dayMonth(ymd)}, ${wd}`;
}
