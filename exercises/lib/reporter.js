'use strict';

/** Друк у консоль: кольори, галочки, підсумок. Ніякої логіки перевірок тут немає. */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code, text) => (useColor ? `${ESC}[${code}m${text}${ESC}[0m` : text);

const c = {
  green: (t) => paint(32, t),
  red: (t) => paint(31, t),
  yellow: (t) => paint(33, t),
  grey: (t) => paint(90, t),
  bold: (t) => paint(1, t),
  cyan: (t) => paint(36, t),
};

const line = (text = '') => console.log(text);

/** Прибирає спільний відступ у багаторядкових шаблонних рядках (brief / explain). */
function dedent(text) {
  const rows = String(text).replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const indents = rows.filter((r) => r.trim()).map((r) => r.match(/^ */)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return rows.map((r) => r.slice(cut));
}

const TYPE_LABEL = { prediction: 'ПЕРЕДБАЧЕННЯ', code: 'КОД', demo: 'ДЕМО' };

function welcome() {
  line();
  line(c.bold('  Week 1 -> Week 2 · інтерактивні таски'));
  line();
  line('  Перевірка сама запускає твій сервер, робить до нього запити');
  line('  і показує, що вийшло. Окремо нічого запускати не треба.');
  line();
  line(c.grey('  Далі буде 8 тасків. Кожен пояснює, що саме зробити.'));
  line(c.grey('  Не поспішай: на 06 закладай найбільше часу.'));
  line();
}

function scanning() {
  line(c.grey('  Дивлюсь, що вже зроблено...'));
}

/** Підпис стану таска. Демо не може бути "готовим" — його просто дивляться. */
function statusMark(result) {
  if (result.type === 'demo') return c.grey('подивитись');
  return {
    passed: c.green('готово'),
    failed: c.red('є помилки'),
    blocked: c.grey('ще не почато'),
  }[result.status];
}

function progressTable(results) {
  line();
  line(c.bold('  Де ти зараз:'));
  for (const r of results) {
    line(`    ${r.id}  ${r.title.padEnd(42)} ${statusMark(r)}`);
  }
  line();
}

function taskIntro(task, position, total) {
  line();
  line(c.bold(`${'='.repeat(64)}`));
  line(c.bold(`  ТАСК ${task.id} · ${task.title}`));
  line(c.grey(`  ${position} з ${total}   ·   тип: ${TYPE_LABEL[task.type]}`));
  line(c.bold(`${'='.repeat(64)}`));
  line();
  line(c.bold('  ЩО ТРЕБА ЗРОБИТИ'));
  line();
  for (const row of dedent(task.brief)) line(`  ${row}`);
  line();
}

function retryIntro(task) {
  line();
  line(c.grey(`  Таск ${task.id} · ${task.title} — пробуємо ще раз.`));
  line(c.grey('  Що саме треба зробити — написано вище, воно не змінилось.'));
  line();
}

function checksHeader() {
  line(c.bold('  ПЕРЕВІРКА'));
  line();
}

function checkLine(name, ok, hint) {
  line(`  ${ok ? c.green('OK  ') : c.red('НІ  ')} ${name}`);
  if (!ok && hint) {
    for (const row of String(hint).split('\n')) line(c.yellow(`        ${row}`));
  }
}

function infoLine(text) {
  for (const row of String(text).split('\n')) line(c.grey(`  ${row}`));
}

function explain(text) {
  line();
  line(c.cyan('  ЧОМУ САМЕ ТАК'));
  line();
  for (const row of dedent(text)) line(c.cyan(`  ${row}`));
  line();
}

function passed(task) {
  line();
  line(c.green(`  Таск ${task.id} пройдено.`));
}

function failed(counts) {
  line();
  line(c.yellow(`  Поки не все: ${counts.ok} з ${counts.total} перевірок зійшлися.`));
  line(c.yellow('  Подивись жовті підказки під червоними рядками — там написано, що не так.'));
  line();
}

function blocked(reason) {
  line();
  line(c.yellow(`  ${reason}`));
  line();
}

function crashed(error) {
  line();
  line(c.red(`  Перевірку не вдалося виконати: ${error.message}`));
  line();
}

function commitHint(task) {
  line(c.grey(`  Гарний момент зберегти роботу:`));
  line(c.grey(`    git add -A && git commit -m "Task ${task.id} done"`));
  line();
}

function finale(results) {
  // Демо не рахуємо: там нема чого "проходити", його просто дивляться.
  const scored = results.filter((r) => r.type !== 'demo');
  const passedCount = scored.filter((r) => r.status === 'passed').length;
  const rest = results.filter((r) => r.status !== 'passed');

  line();
  line(c.bold('='.repeat(64)));
  line(c.bold('  ПІДСУМОК'));
  line(c.bold('='.repeat(64)));
  line();
  for (const r of results) line(`    ${r.id}  ${r.title.padEnd(42)} ${statusMark(r)}`);
  line();
  line(`  Пройдено ${passedCount} з ${scored.length}.`);
  line();

  if (rest.length === 0) {
    line(c.green('  Усе зелене. Комітимо, пушимо — і переходимо до PostgreSQL.'));
  } else {
    line(c.grey(`  Повернутись і продовжити:  node exercises/run.js ${rest[0].id}`));
  }
  line();
}

/** Короткий підсумок для неінтерактивного запуску (--all). */
function summary(results) {
  finale(results);
}

module.exports = {
  c,
  line,
  welcome,
  scanning,
  progressTable,
  taskIntro,
  retryIntro,
  checksHeader,
  checkLine,
  infoLine,
  explain,
  passed,
  failed,
  blocked,
  crashed,
  commitHint,
  finale,
  summary,
};
