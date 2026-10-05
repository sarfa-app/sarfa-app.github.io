import type { BlockId, Category, Fund } from './types';

export const BLOCKS: { id: BlockId; name: string }[] = [
  { id: 'ob', name: 'Обязательные' },
  { id: 'fam', name: 'Семья и родня' },
  { id: 'var', name: 'Переменные расходы' },
];

export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Еда, кафе, доставки', block: 'ob' },
  { id: 'self', name: 'Для себя', block: 'ob' },
  { id: 'auto', name: 'Авто: топливо, мойка', block: 'ob' },
  { id: 'health', name: 'Здоровье семьи', block: 'ob' },
  { id: 'utils', name: 'Коммуналка, связь, подписки', block: 'ob' },
  { id: 'wife', name: 'Жене на личные', block: 'ob' },
  { id: 'fam', name: 'Семья и родня', block: 'fam' },
  { id: 'var', name: 'Переменные расходы', block: 'var' },
  { id: 'unacc_ob', name: 'Не записано — обязательные', block: 'ob', system: true },
  { id: 'unacc_fam', name: 'Не записано — семья', block: 'fam', system: true },
  { id: 'unacc_var', name: 'Не записано — переменные', block: 'var', system: true },
];

export const FUNDS: Fund[] = [
  { id: 'f_auto', name: 'Авто: тех.осмотр и ремонт' },
  { id: 'f_rod', name: 'Здоровье и покупки родне' },
  { id: 'f_home', name: 'Свой быт и техника' },
];

/** Категория, в которую по умолчанию попадает трата из фонда (видна только в журнале). */
export const FUND_DEFAULT_CATEGORY: Record<string, string> = {
  f_auto: 'auto',
  f_rod: 'fam',
  f_home: 'var',
};

export const UNACCOUNTED_BY_BLOCK: Record<BlockId, string> = {
  ob: 'unacc_ob',
  fam: 'unacc_fam',
  var: 'unacc_var',
};

export const DEFAULT_THRESHOLD = 2000;

/** Лимит на помощь родне по умолчанию для месяцев из заметок. */
export const DEFAULT_FAM_LIMIT = 3000;

/** Порог отклонения темпа от календаря. */
export const PACE_TOLERANCE = 0.08;

const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const fundById = new Map(FUNDS.map((f) => [f.id, f]));

export function getCategory(id: string): Category | undefined {
  return categoryById.get(id);
}

export function getFund(id: string): Fund | undefined {
  return fundById.get(id);
}

export function categoriesOfBlock(block: BlockId): Category[] {
  return CATEGORIES.filter((c) => c.block === block);
}

export const USER_CATEGORIES = CATEGORIES.filter((c) => !c.system);

/** Короткие подписи для чипов в форме траты. */
export const SHORT_NAME: Record<string, string> = {
  food: 'Еда',
  self: 'Для себя',
  auto: 'Авто',
  health: 'Здоровье',
  utils: 'Коммуналка',
  wife: 'Жене',
  fam: 'Семья, родня',
  var: 'Переменные',
  unacc_ob: 'Не записано',
  unacc_fam: 'Не записано',
  unacc_var: 'Не записано',
};
