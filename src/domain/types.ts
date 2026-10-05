export type BlockId = 'ob' | 'fam' | 'var';

export interface Category {
  id: string;
  name: string;
  block: BlockId;
  /** служебные категории «Не записано», их нельзя выбрать вручную */
  system?: boolean;
}

export interface Fund {
  id: string;
  name: string;
}

export type Payment = 'cash' | 'card';

export interface Tx {
  id: string;
  /** YYYY-MM-DD, редактируемая */
  date: string;
  /** смн, целое, > 0 */
  amount: number;
  categoryId: string;
  note: string;
  payment: Payment;
  /** сколько из суммы ушло с основного счёта, 0..amount */
  fromMain: number;
  /** если трата покрыта из фонда, лимиты месяца не трогаются */
  fundId?: string;
  /** ISO */
  createdAt: string;
}

export type Routing = 'blocks' | 'savings';

export interface Income {
  id: string;
  date: string;
  amount: number;
  /** «Зарплата», «KPI», «Отпускные» */
  label: string;
  /** в конверты или сразу на основной счёт */
  routing: Routing;
}

export interface Month {
  /** '2026-10' */
  ym: string;
  incomes: Income[];
  /** categoryId → лимит */
  limits: Record<string, number>;
  /** fundId → сколько откладываем в этом месяце */
  fundPlan: Record<string, number>;
  txs: Tx[];
  /** доход разнесён по конвертам */
  distributed: boolean;
  /**
   * Сколько прибавили к основному счёту при распределении. Нужно, чтобы заметить
   * доход или план, изменённые уже после распределения, и доразнести разницу.
   */
  distributedDelta?: number;
  closed: boolean;
  closedAt?: string;
}

/** Месяц из заметок до приложения: только итоги, без транзакций. */
export interface HistoryEntry {
  ym: string;
  income: number;
  expense: number;
  /** данные неполные — расход занижен */
  incomplete?: boolean;
  /** помощь родне за месяц, если считалась */
  famHelp?: number;
  /** лимит на помощь родне в этом месяце */
  famLimit?: number;
}

export interface Settings {
  bigFromMainThreshold: number;
}

export interface State {
  version: 2;
  /** фактический остаток основного счёта СЕЙЧАС */
  mainAccount: number;
  /** «мне должны» */
  receivables: number;
  /** накоплено по фондам */
  fundBalances: Record<string, number>;
  /** ключ 'YYYY-MM' */
  months: Record<string, Month>;
  settings: Settings;
  /** итоги месяцев, которые велись до приложения (экран «История») */
  history: HistoryEntry[];
}
