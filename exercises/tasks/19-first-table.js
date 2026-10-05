'use strict';

/**
 * Таск 18 — перша таблиця і SQL руками.
 *
 * Досі "база даних" була просто масивом у пам'яті. Тут з'являється справжня
 * таблиця — і разом з нею те, чого масив не вмів: правила, яких неможливо
 * порушити, бо за ними стежить не твій код, а сама база.
 *
 * Застосунок у цьому таску не бере участі взагалі. Тільки psql і SQL.
 */

/** Перевірка поведінки робиться в транзакції й відкочується — твої дані цілі. */
async function probeInTransaction(t, fn) {
  await t.db.query('BEGIN');
  try {
    return await fn();
  } finally {
    await t.db.query('ROLLBACK');
  }
}

module.exports = {
  id: '19',
  week: 3,
  type: 'code',
  title: 'Перша таблиця і SQL руками',
  needsServer: false,

  brief: `
    Тут немає файлів, які треба створити. Усе робиться в самій базі.

    Заходиш у psql всередині контейнера:

      docker compose exec db psql -U todo -d todo

    І створюєш таблицю todos — рівно з такими полями:

      id          ціле, первинний ключ, база генерує сама
      title       текст, обов'язковий
      completed   так/ні, обов'язковий, за замовчуванням false
      created_at  момент часу з таймзоною, обов'язковий,
                  за замовчуванням поточний час

    Підказка по типах: SERIAL, TEXT, BOOLEAN, TIMESTAMPTZ.
    Правила пишуться прямо в оголошенні колонки: PRIMARY KEY, NOT NULL, DEFAULT.

    Потім обов'язково порозважайся з даними руками — додай кілька рядків,
    подивись на них, зміни, видали:

      INSERT INTO todos (title) VALUES ('Прочитати про SQL');
      SELECT * FROM todos;
      UPDATE todos SET completed = true WHERE id = 1;
      DELETE FROM todos WHERE id = 1;

    Корисні команди psql:  \\dt  список таблиць ·  \\d todos  опис таблиці ·  \\q  вийти

    Перевірка дивиться на СХЕМУ — чи правильні типи й правила. Твої рядки вона
    не чіпає: усі проби робляться в транзакції й відкочуються.
  `,

  async run(t) {
    const table = await t.db.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'todos'`
    );

    if (table.rows.length === 0) {
      t.blocked(
        'Таблиці todos у базі ще немає.\n' +
          '    Зайди в psql і створи її — як саме, написано вище.'
      );
    }

    const columns = await t.db.query(
      `SELECT column_name, data_type, is_nullable, column_default, is_identity
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'todos'`
    );
    const byName = Object.fromEntries(columns.rows.map((c) => [c.column_name, c]));

    t.info(`У таблиці todos зараз колонки: ${columns.rows.map((c) => c.column_name).join(', ')}\n`);

    // --- id ---
    const id = byName.id;
    t.check(
      'Колонка id існує і має цілий тип',
      id && /^(integer|bigint|smallint)$/.test(id.data_type),
      id ? `зараз тип "${id.data_type}"` : 'колонки id немає зовсім'
    );

    t.check(
      'id генерується базою автоматично',
      id && (/nextval/.test(id.column_default || '') || id.is_identity === 'YES'),
      'Не бачу автогенерації. Тип SERIAL (або GENERATED ALWAYS AS IDENTITY)\n' +
        'змушує базу саму видавати наступне число — і вона ніколи не\n' +
        'помиляється так, як помилявся users.length + 1 у таску 04.'
    );

    const primaryKey = await t.db.query(
      `SELECT a.attname
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'todos'::regclass AND i.indisprimary`
    );
    t.check(
      'id — первинний ключ таблиці',
      primaryKey.rows.length === 1 && primaryKey.rows[0].attname === 'id',
      primaryKey.rows.length === 0
        ? 'Первинного ключа немає. PRIMARY KEY гарантує, що такий рядок один\n' +
          'і що знайти його можна швидко.'
        : `первинний ключ зараз по колонці "${primaryKey.rows[0].attname}"`
    );

    // --- title ---
    const title = byName.title;
    t.check(
      'title — текст і обов\'язковий (NOT NULL)',
      title && /char|text/.test(title.data_type) && title.is_nullable === 'NO',
      title
        ? `зараз тип "${title.data_type}", nullable: ${title.is_nullable}`
        : 'колонки title немає'
    );

    // --- completed ---
    const completed = byName.completed;
    t.check(
      'completed — boolean, обов\'язковий, за замовчуванням false',
      completed &&
        completed.data_type === 'boolean' &&
        completed.is_nullable === 'NO' &&
        /false/i.test(completed.column_default || ''),
      completed
        ? `зараз тип "${completed.data_type}", nullable: ${completed.is_nullable}, ` +
          `default: ${completed.column_default}`
        : 'колонки completed немає'
    );

    // --- created_at ---
    const createdAt = byName.created_at;
    t.check(
      'created_at — час із таймзоною, обов\'язковий, за замовчуванням поточний час',
      createdAt &&
        createdAt.data_type === 'timestamp with time zone' &&
        createdAt.is_nullable === 'NO' &&
        /now\(\)|CURRENT_TIMESTAMP/i.test(createdAt.column_default || ''),
      createdAt
        ? `зараз тип "${createdAt.data_type}", nullable: ${createdAt.is_nullable}, ` +
          `default: ${createdAt.column_default}\n` +
          'Потрібен саме TIMESTAMPTZ, а не TIMESTAMP: без таймзони той самий\n' +
          'момент часу читається по-різному на різних машинах.'
        : 'колонки created_at немає'
    );

    // --- а тепер перевіряємо, що правила справді працюють ---
    await probeInTransaction(t, async () => {
      const inserted = await t.db.query(
        "INSERT INTO todos (title) VALUES ('проба перевірки') RETURNING id, completed, created_at"
      );
      const row = inserted.rows[0];

      t.check(
        'INSERT лише з title спрацював: id, completed і created_at база заповнила сама',
        row &&
          typeof row.id === 'number' &&
          row.completed === false &&
          row.created_at instanceof Date,
        `повернулось: ${JSON.stringify(row)}`
      );

      const second = await t.db.query(
        "INSERT INTO todos (title) VALUES ('друга проба') RETURNING id"
      );
      t.check(
        `Другий INSERT отримав інший id (${row && row.id} -> ${second.rows[0].id})`,
        second.rows[0].id !== row.id,
        'Два рядки отримали однаковий id — автогенерація не працює.'
      );

      await t.db.query('SAVEPOINT null_probe');
      let rejected = false;
      try {
        await t.db.query('INSERT INTO todos (title) VALUES (NULL)');
      } catch {
        rejected = true;
      }
      await t.db.query('ROLLBACK TO SAVEPOINT null_probe');

      t.check(
        'Спроба вставити рядок без title відхилена самою базою',
        rejected,
        'База прийняла todo без назви. Отже, на колонці title немає NOT NULL —\n' +
          'і тепер будь-яка помилка в коді зможе створити порожній запис.'
      );
    });

    t.info('Усі проби відкочені — твої рядки лишились недоторканими.');
  },

  explain: `
    Головне, що тут сталося: частина правил переїхала з коду в базу.

    Раніше за те, що в todo є назва, відповідав твій if у handler'і. Якщо його
    забути — у масив потрапить сміття. Тепер за це відповідає NOT NULL, і забути
    його неможливо: база відхилить такий рядок, звідки б він не прийшов —
    з твого API, з psql, зі скрипта колеги, з чого завгодно.

    Це називається цілісність даних, і правило просте: якщо щось МАЄ бути
    правдою завжди — нехай це стежить база, а не код. Код можна обійти,
    обмеження в базі — ні.

    Про кожну річ, яку ти написала:

      SERIAL         база сама видає наступне число. Згадай таск 04 з
                     users.length + 1 — ось це більше ніколи не повториться,
                     бо лічильник живе в базі й не вміє йти назад.

      PRIMARY KEY    "цей рядок один такий". Заодно база будує індекс, тому
                     пошук за id миттєвий навіть на мільйонах рядків.

      NOT NULL       значення обов'язкове. NULL у SQL — це не нуль і не
                     порожній рядок, це "невідомо". І поводиться воно дивно:
                     NULL = NULL дає не true, а NULL. Тому там, де значення
                     мусить бути, його краще заборонити одразу.

      DEFAULT        що підставити, коли поле не передали. Завдяки цьому
                     INSERT із самим title працює — решту база дописала сама.

      TIMESTAMPTZ    момент часу разом із таймзоною. Звичайний TIMESTAMP
                     зберігає "14:30" без уточнення, чиє це 14:30, — і одного
                     дня сервер у Франкфурті та користувач у Києві розійдуться
                     на дві години. Для часу подій завжди бери TIMESTAMPTZ.

    І ще одна дрібниця, яку ти, може, не помітила: INSERT ... RETURNING одразу
    повертає створений рядок. У більшості баз треба було б робити INSERT, а
    потім окремий SELECT, щоб дізнатись згенерований id. Postgres віддає його
    одразу — і це рівно те, що потрібно для відповіді 201 Created.
    У наступному таску воно і знадобиться.
  `,
};