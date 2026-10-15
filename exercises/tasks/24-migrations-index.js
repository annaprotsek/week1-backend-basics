'use strict';

/**
 * Таск 24 — міграції та індекс.
 *
 * Останній таск тижня. До цього моменту схема бази існувала тільки в одному
 * місці — у голові тієї, хто набирала CREATE TABLE у psql. Тут вона переїжджає
 * у файли, які лежать у git поруч із кодом.
 */

const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../lib/harness');

const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'todo-api', 'migrations');

function readMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }));
}

module.exports = {
  id: '24',
  week: 3,
  type: 'code',
  title: 'Міграції та індекс',
  target: 'todo',

  brief: `
    Створюєш теку:  todo-api/migrations/

    ── Частина 1. Записати те, що вже є ──

    Файл  001_init.sql  — та сама таблиця, яку ти створювала руками в таску 19.
    Тільки тепер вона записана:

      CREATE TABLE IF NOT EXISTS todos (
        id          SERIAL PRIMARY KEY,
        ...
      );

    IF NOT EXISTS тут обов'язково: таблиця в тебе вже є, і файл має спокійно
    відпрацювати і на твоїй базі, і на порожній.

    ── Частина 2. Змінити схему ──

    Файл  002_add_priority.sql  — дві зміни:

      1. нова колонка priority: ціле, обов'язкове, за замовчуванням 0
      2. індекс по колонці completed

    Застосувати міграції:

      docker compose exec -T db psql -U todo -d todo < todo-api/migrations/001_init.sql
      docker compose exec -T db psql -U todo -d todo < todo-api/migrations/002_add_priority.sql

    ── Частина 3. Показати priority в API ──

    У todo-api/app.py:

      GET    повертає priority разом з рештою полів
      POST   приймає priority: ціле від 0 до 5. Не передали — 0.
      PATCH  уміє міняти priority за тими самими правилами

      priority = 9, -1, "1", 1.5  ->  400 і { error }

    Підказка: ALTER TABLE todos ADD COLUMN ... і CREATE INDEX IF NOT EXISTS ...
  `,

  async run(t) {
    const migrations = readMigrations();

    if (migrations.length === 0) {
      t.blocked(
        'Теки todo-api/migrations/ з .sql файлами ще немає.\n' +
          '    Що саме туди покласти — написано вище.'
      );
    }

    t.info(`Знайдено міграції: ${migrations.map((m) => m.name).join(', ')}\n`);

    const init = migrations.find((m) => /^001/.test(m.name));
    t.check(
      '001_*.sql існує і створює таблицю todos',
      init && /create\s+table/i.test(init.sql) && /todos/i.test(init.sql),
      'Перший файл має містити CREATE TABLE для todos — ту саму таблицю,\n' +
        'яку ти робила руками.'
    );

    t.check(
      '001 можна виконати повторно: там є IF NOT EXISTS',
      init && /if\s+not\s+exists/i.test(init.sql),
      'Без IF NOT EXISTS другий запуск впаде з помилкою "relation already exists".\n' +
        'Міграція має вміти відпрацювати на базі, де вона вже застосована.'
    );

    const second = migrations.find((m) => /^002/.test(m.name));
    t.check(
      '002_*.sql існує',
      Boolean(second),
      'Другий файл — той, що додає колонку priority та індекс.'
    );

    // --- що реально сталося в базі ---
    const column = await t.db.query(
      `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'todos' AND column_name = 'priority'`
    );

    t.check(
      'Колонка priority є в базі: ціле, NOT NULL, за замовчуванням 0',
      column.rows.length === 1 &&
        /^(integer|smallint|bigint)$/.test(column.rows[0].data_type) &&
        column.rows[0].is_nullable === 'NO' &&
        /0/.test(column.rows[0].column_default || ''),
      column.rows.length === 0
        ? 'Колонки немає. Файл написано, але чи застосувала ти його до бази?\n' +
          '  docker compose exec -T db psql -U todo -d todo < todo-api/migrations/002_add_priority.sql'
        : `зараз: тип ${column.rows[0].data_type}, nullable ${column.rows[0].is_nullable}, ` +
          `default ${column.rows[0].column_default}`
    );

    const indexes = await t.db.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'todos'`
    );
    const hasCompletedIndex = indexes.rows.some((i) => /\(\s*completed/i.test(i.indexdef));

    t.check(
      'На колонці completed є індекс',
      hasCompletedIndex,
      `зараз на таблиці такі індекси:\n` +
        indexes.rows.map((i) => `  ${i.indexname}: ${i.indexdef}`).join('\n') +
        '\nІндекс по completed потрібен тому, що саме по цій колонці\n' +
        'фільтрує GET /todos?completed=... з попереднього таска.'
    );

    // --- стара таблиця і нова колонка ---
    await t.db.reset();
    const legacy = await t.db.query(
      "INSERT INTO todos (title) VALUES ('без priority') RETURNING priority"
    );
    t.check(
      'Рядок, вставлений без priority, отримує 0 — а не NULL',
      legacy.rows[0].priority === 0,
      `прийшло ${JSON.stringify(legacy.rows[0].priority)}\n` +
        'Саме для цього в ALTER TABLE пишуть DEFAULT: інакше всі рядки, що вже\n' +
        'були в таблиці, лишились би з NULL, і NOT NULL не вдалося б додати.'
    );

    // --- API ---
    await t.db.reset();

    const created = await t.api('POST', '/todos', { title: 'Терміново', priority: 3 });
    t.check(
      'POST з priority: 3 -> 201 і priority у відповіді',
      created.status === 201 && created.body && created.body.priority === 3,
      `а прийшло ${created.status}: ${created.text.slice(0, 160)}`
    );

    const storedPriority = await t.db.query('SELECT priority FROM todos WHERE id = $1', [
      created.body && created.body.id,
    ]);
    t.check(
      'priority записався саме в базу',
      storedPriority.rows.length === 1 && storedPriority.rows[0].priority === 3,
      `у базі: ${JSON.stringify(storedPriority.rows[0])}`
    );

    const noPriority = await t.api('POST', '/todos', { title: 'Звичайне' });
    t.check(
      'POST без priority -> priority = 0',
      noPriority.status === 201 && noPriority.body.priority === 0,
      `priority = ${JSON.stringify(noPriority.body && noPriority.body.priority)}`
    );

    for (const bad of [9, -1, '1', 1.5]) {
      const res = await t.api('POST', '/todos', { title: 'Крива', priority: bad });
      t.check(
        `POST з priority: ${JSON.stringify(bad)} -> 400`,
        res.status === 400,
        `а прийшло ${res.status}: ${res.text.slice(0, 140)}`
      );
    }

    const patched = await t.api('PATCH', `/todos/${created.body.id}`, { priority: 5 });
    const patchedDb = await t.db.query('SELECT priority FROM todos WHERE id = $1', [
      created.body.id,
    ]);
    t.check(
      'PATCH уміє міняти priority',
      patched.status === 200 && patchedDb.rows[0].priority === 5,
      `статус ${patched.status}, у базі priority = ${patchedDb.rows[0].priority}`
    );
  },

  explain: `
    Два великих висновки з цього таска.

    ── Перший: схема бази — це теж код ──

    До цього моменту твоя таблиця існувала тільки тому, що ти колись набрала
    CREATE TABLE у psql. Нічого про це не записано. Новий розробник у команді
    не має як відтворити базу; на сервері вона може відрізнятись від твоєї;
    а як саме вона дійшла до нинішнього вигляду — не знає ніхто.

    Міграції це лікують. Схема описана послідовністю файлів, кожен робить один
    крок, і разом вони відтворюють базу з нуля в будь-якому місці. Файли лежать
    у git поруч із кодом — отже, їх видно в пул-реквесті, і зміну схеми можна
    обговорити так само, як зміну функції.

    Чому номери: 001, 002, 003 — порядок має значення. Не можна додати колонку
    в таблицю, якої ще немає. Міграції завжди виконуються в одному й тому ж
    порядку, і саме тому результат однаковий у всіх.

    Чому IF NOT EXISTS: у справжніх проєктах цим займається інструмент
    (Alembic у Python, node-pg-migrate у Node). Він тримає в базі службову
    таблицю зі списком уже застосованих міграцій і сам пропускає зроблене.
    Ми робимо це руками, тому страхуємось у самому SQL. Принцип той самий:
    міграція має бути безпечною при повторному запуску.

    І найважливіше правило, яке варто засвоїти одразу: застосовану міграцію
    НЕ РЕДАГУЮТЬ. У тебе вона вже відпрацювала, а в колеги — ні, і ви отримаєте
    різні бази з однакового репозиторію. Помилилась — пишеш 003, яка виправляє.

    ── Другий: індекс ──

    Без індексу база на запит "дай усі completed = true" читає таблицю цілком
    і дивиться кожен рядок. Це називається Seq Scan — послідовне сканування.
    На 25 рядках воно миттєве. На мільйоні — ні.

    Індекс — це окрема структура, схожа на алфавітний покажчик у кінці книги:
    замість гортати всі сторінки, ти дивишся в покажчик і одразу йдеш куди треба.

    Подивись на власні очі:

      EXPLAIN SELECT * FROM todos WHERE completed = true;

    На 25 рядках ти, швидше за все, і зараз побачиш Seq Scan — і це не помилка.
    База вважає, що прочитати крихітну таблицю цілком дешевше, ніж лізти в
    індекс і потім ще й у таблицю. Вона права. Створи кілька тисяч рядків —
    і план зміниться сам.

    Чому тоді не наставити індексів на всі колонки? Бо вони не безкоштовні:
    кожен індекс займає місце і сповільнює кожен INSERT, UPDATE і DELETE —
    його теж треба оновлювати. Тому індекси ставлять під конкретні запити,
    які справді виконуються часто. У нас такий один: фільтр по completed
    з попереднього таска.

    ── І підсумок тижня ──

    Згадай таск 14 з другого тижня: там ти дивилась, як дані зникають після
    перезапуску сервера. Зроби це ще раз зараз.

      docker compose restart db
      ... дані на місці

    Більше того: тепер можна підняти два застосунки на різних портах, і обидва
    бачитимуть одні й ті самі todo. Саме це було неможливо з масивом у пам'яті —
    і саме тому стан виносять із процесу назовні.
  `,
};