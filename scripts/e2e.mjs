// Сквозная проверка интерфейса по критериям приёмки на сборке с локальным бэкендом.
//   VITE_BACKEND=mock npx vite build --outDir dist-mock
//   npx vite preview --outDir dist-mock --port 4173
//   node scripts/e2e.mjs <файл-импорта.json> [папка-для-скриншотов] [axe.min.js]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}

const [seedPath, shots = 'test-results', axePath] = process.argv.slice(2);
if (!seedPath) throw new Error('Укажите файл импорта');
mkdirSync(shots, { recursive: true });
const URL = process.env.E2E_URL ?? 'http://localhost:4173/sarfa/';

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures += 1;
};
const nb = (s) => s.replace(/[  ]/g, ' ').replace(/−/g, '-');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
  timezoneId: 'Asia/Dushanbe',
  acceptDownloads: true,
  bypassCSP: true, // только чтобы подключить axe-core для проверки доступности
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name, full = false) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: full });
const text = async () => nb(await page.locator('body').innerText());
const dialog = () => page.locator('[role="dialog"]').last();

// ---------- Регистрация ----------
await page.goto(URL);
await page.getByRole('tab', { name: 'Регистрация' }).click();
await shot('01-auth');
await page.getByLabel('Логин').fill('alisher');
await page.getByLabel('Пароль', { exact: true }).fill('qwerty');
await page.getByLabel('Пароль ещё раз').fill('qwerty');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
ok((await text()).includes('минимум 8'), 'слабый пароль отклонён');
await page.getByLabel('Пароль', { exact: true }).fill('parol-2026');
await page.getByLabel('Пароль ещё раз').fill('parol-2026');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
await page.getByText('Добро пожаловать').waitFor();
await shot('02-setup');

// ---------- Импорт стартовых данных ----------
await page.locator('input[type=file]').setInputFiles(seedPath);
await page.getByText('Осталось по плану').waitFor();
let t = await text();
ok(t.includes('Доход ещё не распределён'), 'до распределения — подсказка «Доход ещё не распределён»');
ok(/Основной счёт сейчас\s*6 256 смн/.test(t), 'приёмка 7: основной счёт 6 256 до распределения');
ok(t.includes('План месяца\n17 300 смн') || /План месяца\s*17 300/.test(t), 'приёмка 4: план 17 300');
ok(/На основной счёт\s*\+4 556/.test(t), 'приёмка 4: в накопления 4 556');
ok(/Станет к концу месяца\s*прогноз/.test(t), 'приёмка 8: прогноз подписан');
await shot('03-month', true);

// ---------- Распределение ----------
await page.getByRole('button', { name: 'Распределить доход' }).first().click();
await shot('03b-distribute');
await dialog().getByRole('button', { name: 'Распределить' }).click();
t = await text();
ok(/Основной счёт сейчас\s*10 812 смн/.test(t), 'после распределения 10 812');
ok(!t.includes('Доход ещё не распределён'), 'подсказка исчезла');

// ---------- Запись траты ----------
const openAdd = async () => {
  await page.getByRole('button', { name: 'Записать трату' }).click();
  await dialog().waitFor();
  await page.waitForTimeout(350); // анимация шита
};
const typeAmount = async (digits) => {
  for (const d of digits) await dialog().getByRole('button', { name: d, exact: true }).click();
};
await openAdd();
await shot('04-add-empty');
const fit = await page.evaluate(() => {
  const d = document.querySelectorAll('[role="dialog"]');
  const el = d[d.length - 1];
  const btn = [...el.querySelectorAll('button')].find((b) => b.textContent.startsWith('Записать'));
  const r = btn.getBoundingClientRect();
  const over = [...el.querySelectorAll('*:not(.sr-only)')].some((n) => n.scrollHeight > n.clientHeight + 1 && getComputedStyle(n).overflowY !== 'visible' && n.clientHeight > 0);
  const pad = el.querySelector('[aria-label="Цифровая клавиатура"]').getBoundingClientRect();
  return { inView: r.bottom <= window.innerHeight && r.top > 0 && pad.bottom <= r.top, noScroll: !over, h: window.innerHeight, b: r.bottom, key: Math.round(pad.height / 4) };
});
console.log('  форма:', JSON.stringify(fit));
ok(fit.inView && fit.noScroll, 'приёмка 15: форма траты помещается на экран, кнопка видна');
await typeAmount('350');
await dialog().getByRole('button', { name: /^Еда,/ }).click();
await dialog().getByRole('button', { name: 'Вчера' }).click();
await dialog().getByRole('button', { name: 'Наличка' }).click();
await dialog().getByLabel('Заметка').fill('Обед');
await shot('04-add-filled');
await dialog().getByRole('button', { name: /^Записать/ }).click();
await page.getByRole('status').getByText('Записано').waitFor();
await shot('05-toast');
ok(await page.getByRole('status').getByRole('button', { name: 'Отменить' }).isVisible(), 'приёмка 20: тост с «Отменить»');

// Отмена в течение 5 секунд
await openAdd();
await typeAmount('77');
await dialog().getByRole('button', { name: /^Для себя,/ }).click();
await dialog().getByRole('button', { name: /^Записать/ }).click();
await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click();
t = await text();
ok(/Для себя\s*0 \/ 1 500/.test(t), 'отмена убрала трату');

// ---------- Трата сверх лимита ----------
await openAdd();
await typeAmount('4000');
await dialog().getByRole('button', { name: /^Еда,/ }).click();
await dialog().getByRole('button', { name: /^Записать/ }).click();
await page.getByText('не вмещает трату').waitFor();
await shot('06-overflow');
const options = await dialog().locator('button').allInnerTexts();
const idx = (s) => options.findIndex((o) => o.includes(s));
ok(idx('Отложить') >= 0 && idx('Отложить') < idx('Вытеснить') && idx('Вытеснить') < idx('Взять с основного'), 'приёмка 9: три варианта, «Отложить» первым');
t = await text();
ok(/Не хватает 850 смн/.test(t), 'недостача 850');
ok(t.includes('По твоему правилу траты меньше 2 000 смн с основного счёта не берутся'), 'приёмка 10: предупреждение о правиле');
await dialog().getByRole('button', { name: /Вытеснить/ }).click();
await shot('06b-displace');
await dialog().getByRole('button', { name: 'Вернуться к записи' }).click();
await dialog().getByRole('button', { name: /^Записать/ }).click();
await dialog().getByRole('button', { name: /Взять с основного/ }).click();
t = await text();
ok(t.includes('добрано с основного счёта: 850 смн'), 'приёмка 11: строка «добрано с основного счёта»');
ok(/Против правила/.test(t), 'нарушение правила видно на главном');

// ---------- Сверка наличных ----------
const foodBefore = (await text()).match(/Еда, кафе, доставки\s*([\d ]+) \/ 3 500/)?.[1];
await page.getByRole('button', { name: 'Сверить наличку по блокам' }).click();
const obField = dialog().getByLabel('Фактически в конверте').first();
const expected = nb(await dialog().innerText()).match(/Обязательные\s*по записям ([\d -]+) смн/)?.[1]?.replace(/ /g, '');
await obField.fill(String(Number(expected) - 300));
await shot('07-reconcile');
await dialog().getByRole('button', { name: /Записать разницу/ }).click();
t = await text();
ok(/Не записано — обязательные\s*300 \/ 0/.test(t), 'приёмка 12: разница в «Не записано — обязательные»');
ok(t.match(/Еда, кафе, доставки\s*([\d ]+) \/ 3 500/)?.[1] === foodBefore, 'приёмка 12: еда не изменилась');

// ---------- Трата из фонда ----------
const limitsBefore = (await text()).match(/(\d[\d ]*) \/ \d[\d ]* смн/g)?.join('|');
await page.getByRole('button', { name: 'Потратить из фонда' }).first().click();
for (const d of '500') await dialog().getByRole('button', { name: d, exact: true }).click();
await dialog().getByRole('button', { name: /^Потратить 500/ }).click();
await page.getByText('Не хватает').first().waitFor();
await shot('08-fund-shortfall');
await dialog().getByRole('button', { name: /Добрать 500/ }).click();
t = await text();
ok((await text()).match(/(\d[\d ]*) \/ \d[\d ]* смн/g)?.join('|') === limitsBefore, 'приёмка 13: трата из фонда не меняет лимиты и блоки');

// ---------- Журнал ----------
await page.getByRole('button', { name: 'Траты' }).click();
await shot('09-journal', true);
t = await text();
ok(/\d+ трат/.test(t), 'шапка журнала: количество и сумма');
await page.getByRole('button', { name: /Обед/ }).click();
await shot('09b-edit');
await dialog().getByLabel('Заметка').fill('Обед с коллегами');
await dialog().getByRole('button', { name: 'Сохранить' }).click();
ok((await text()).includes('Обед с коллегами'), 'редактирование заметки');
await page.getByLabel('Поиск по заметке').fill('коллег');
ok(/1 трата/.test(await text()), 'поиск по заметке');
await page.getByLabel('Поиск по заметке').fill('');

// Сентябрь: 40 трат
await page.getByRole('button', { name: /Предыдущий месяц/ }).click();
t = await text();
ok(/40 трат на 25 914 смн/.test(t), 'приёмка 5: сентябрь 40 трат на 25 914');

// ---------- История ----------
await page.getByRole('button', { name: 'История' }).click();
await shot('10-history', true);
t = await text();
ok(/Доход всего\s*389 262/.test(t) && /Расход всего\s*356 842/.test(t), 'приёмка 6: доход и расход');
ok(/Норма сбережений\s*8%/.test(t) && /Месяцев в минусе\s*9 из 20/.test(t), 'приёмка 6: норма 8%, 9 из 20');
ok(/Среднее\s*4 318/.test(t), 'помощь родне: среднее 4 318');
ok(t.includes('Данные неполные'), 'сноска о неполных данных');

// ---------- Навигация по месяцам не создаёт пустых ----------
await page.getByRole('button', { name: 'Месяц', exact: true }).click();
const monthsBefore = await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('mock:budget:'));
  return Object.keys(JSON.parse(localStorage.getItem(k)).state.months).join(',');
});
const clickIfEnabled = async (re) => {
  const b = page.getByRole('button', { name: re });
  if (await b.isEnabled()) await b.click();
};
for (let i = 0; i < 6; i++) await clickIfEnabled(/Следующий месяц|Следующего месяца нет/);
await shot('11-future');
ok((await text()).includes('Ноябрь 2026 ещё не начат'), 'следующий месяц — заглушка без создания');
for (let i = 0; i < 6; i++) await clickIfEnabled(/Предыдущий месяц|Предыдущего месяца нет/);
await page.waitForTimeout(500);
const monthsAfter = await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('mock:budget:'));
  return Object.keys(JSON.parse(localStorage.getItem(k)).state.months).join(',');
});
ok(monthsBefore === monthsAfter && monthsAfter === '2026-09,2026-10', `приёмка 3: пустых месяцев нет (${monthsAfter})`);

// ---------- Перезапуск ----------
await page.waitForTimeout(800);
await page.reload();
await page.getByText('Осталось по плану').waitFor();
await page.getByRole('button', { name: 'Траты' }).click();
ok((await text()).includes('Обед с коллегами'), 'приёмка 1: трата на месте после перезапуска');

// ---------- Экспорт / импорт ----------
await page.getByRole('button', { name: 'Настройки' }).click();
await shot('12-settings', true);
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Экспорт в файл' }).click()]);
const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
ok(exported.version === 2 && exported.months['2026-10'].txs.length > 0, 'приёмка 2: экспорт даёт JSON');
await page.locator('input[type=file]').setInputFiles(await download.path());
await dialog().getByRole('button', { name: 'Заменить' }).click();
await page.waitForTimeout(600);
const roundtrip = await page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('mock:budget:'));
  return JSON.parse(localStorage.getItem(k)).state;
});
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
ok(JSON.stringify(canon(roundtrip)) === JSON.stringify(canon(exported)), 'приёмка 2: импорт восстанавливает состояние полностью');

// ---------- Закрытие месяца и новые лимиты ----------
await page.getByRole('button', { name: 'Месяц', exact: true }).click();
const fundsBefore = nb(await page.locator('#funds-title').locator('..').innerText());
await page.getByRole('button', { name: 'Закрыть месяц' }).click();
await shot('13-close-summary');
await dialog().getByRole('button', { name: 'Закрыть октябрь' }).click();
await page.getByText('Лимиты на ноябрь').waitFor();
await shot('14-new-limits');
await dialog().getByLabel('Здоровье семьи').fill('2000');
ok((await dialog().innerText()).includes('было 1'), 'видно прошлое значение лимита');
await dialog().getByRole('button', { name: 'Сохранить лимиты' }).click();
t = await text();
ok(t.includes('Ноябрь 2026'), 'открылся ноябрь');
ok(/Здоровье семьи\s*0 \/ 2 000/.test(t), 'новый лимит ноября сохранён');
const fundsAfter = nb(await page.locator('#funds-title').locator('..').innerText());
ok(/Авто: тех\.осмотр и ремонт\s*900 смн/.test(fundsAfter) && fundsBefore !== fundsAfter, 'приёмка 14: фонды пополнились');
await shot('15-november', true);

// ---------- Доступность ----------
if (axePath) {
  await page.addScriptTag({ content: readFileSync(axePath, 'utf8') });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] });
    return r.violations.map((v) => `${v.id}: ${v.nodes.length} — ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  ok(res.length === 0, `axe (главный экран): ${res.length ? res.join('; ') : 'нарушений нет'}`);
}
const small = await page.evaluate(() =>
  [...document.querySelectorAll('button, a, input, select')]
    .filter((e) => e.offsetParent !== null && !e.classList.contains('sr-only'))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ e, r }) => `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent).slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`),
);
ok(small.length === 0, `зоны нажатия ≥ 44px: ${small.join(', ') || 'все'}`);

// ---------- Второй пользователь не видит чужое ----------
const aliceUid = await page.evaluate(() => JSON.parse(localStorage.getItem('mock:users')).alisher.uid);
await page.getByRole('button', { name: 'Настройки' }).click();
await page.getByRole('button', { name: 'Выйти' }).click();
await page.getByRole('tab', { name: 'Регистрация' }).click();
await page.getByLabel('Логин').fill('bob');
await page.getByLabel('Пароль', { exact: true }).fill('another-pass');
await page.getByLabel('Пароль ещё раз').fill('another-pass');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
await page.getByText('Добро пожаловать').waitFor();
const leaked = await page.evaluate((uid) => Object.keys(localStorage).filter((k) => k.startsWith(`sarfa:v1:${uid}:`)).length, aliceUid);
ok(leaked === 0, 'после выхода кэш прошлого пользователя удалён с устройства');
ok(!(await text()).includes('Обед'), 'второй пользователь начинает с чистого листа');

// ---------- Узкий экран 320px ----------
await page.getByRole('button', { name: 'Выйти' }).click();
await page.getByRole('tab', { name: 'Вход' }).click();
await page.setViewportSize({ width: 320, height: 568 });
await page.getByLabel('Логин').fill('alisher');
await page.getByLabel('Пароль', { exact: true }).fill('parol-2026');
await page.getByRole('button', { name: 'Войти' }).click();
await page.getByText('Осталось по плану').waitFor();
ok((await text()).includes('Ноябрь 2026'), 'после повторного входа данные загрузились с сервера');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(overflow <= 0, `приёмка 17: на 320px нет горизонтальной прокрутки (${overflow})`);
await shot('16-320px');
await openAdd();
const fit2 = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const btn = [...d.querySelectorAll('button')].find((b) => b.textContent.startsWith('Записать'));
  const pad = d.querySelector('[aria-label="Цифровая клавиатура"]').getBoundingClientRect();
  const r = btn.getBoundingClientRect();
  return r.bottom <= window.innerHeight && pad.bottom <= r.top;
});
ok(fit2, 'форма траты помещается на iPhone SE 1-го поколения (320×568)');
await shot('17-320px-add');

ok(errors.length === 0, `ошибок в консоли нет${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failures ? `\nПровалено проверок: ${failures}` : '\nВсе проверки пройдены');
process.exit(failures ? 1 : 0);
