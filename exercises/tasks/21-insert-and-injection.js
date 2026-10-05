'use strict';

/**
 * Таск 20 — POST /todos, INSERT ... RETURNING і параметризовані запити.
 *
 * Найважливіший таск тижня з точки зору безпеки. Тут перевірка спеціально
 * намагається знести твою таблицю через звичайне поле title — і має отримати
 * по носі.
 */

const INJECTION = "Robert'); DROP TABLE todos; --";
const QUOTED = "it's a trap";

module.exports = {
  id: '21',
  week: 3,
  type: 'code',
  title: 'POST /todos і параметризовані запити',
  target: 'todo',

  brief: `
    Редагуєш файл:  todo-api/app.py

    Додай створення:

      POST /todos   тіло: { "title": "...", "completed": false }
                    -> 201, заголовок Location: /todos/<id>
                       і створений todo: { id, title, completed, created_at }

    Валідація (все -> 400 і { "error": "..." }):
      title      — обов'язковий, текст, непорожній
      completed  — якщо переданий, має бути саме boolean (не "true", не 1)

    id не вигадуєш — його видає база. Забери створений рядок одразу:

      INSERT INTO todos (title, completed) VALUES (%s, %s) RETURNING *

    І тепер головне правило цього таска, запам'ятай його дослівно:

      ЗНАЧЕННЯ НІКОЛИ НЕ СКЛЕЮЮТЬСЯ З ТЕКСТОМ ЗАПИТУ.

      так НЕ можна:   f"INSERT INTO todos (title) VALUES ('{title}')"
      так треба:      conn.execute("INSERT INTO todos (title) VALUES (%s)", [title])

    %s тут — не підстановка рядка. Це місце для значення: драйвер передає запит
    і дані окремо, і база ніколи не сприймає дані як команду.

    Перевірка спробує створити todo з назвою:

      Robert'); DROP TABLE todos; --

    Якщо ти склеюєш запит рядками — таблиці після цього не стане.
    Якщо робиш правильно — це буде просто дивна назва todo.
  `,

  async run(t) {
    await t.db.reset();

    // --- створення ---
    const created = await t.api('POST', '/todos', { title: 'Купити хліб' });

    t.check(
      'POST /todos з коректним тілом -> 201',
      created.status === 201,
      `а прийшло ${created.status}, відповідь: ${created.text.slice(0, 160)}`
    );

    const todo = created.body || {};
    t.check(
      'У відповіді є створений todo з id від бази',
      typeof todo.id === 'number' &&
        todo.title === 'Купити хліб' &&
        todo.completed === false &&
        'created_at' in todo,
      `а прийшло: ${JSON.stringify(todo)}\n` +
        'completed без значення має стати false — за це відповідає DEFAULT у базі.'
    );

    t.check(
      `Є заголовок Location: /todos/${todo.id}`,
      created.headers.location === `/todos/${todo.id}`,
      `а Location = ${created.headers.location ?? '(заголовка немає)'}\n` +
        'Урок із таска 11: на 201 клієнт має отримати адресу створеної речі.'
    );

    // --- рядок справді в базі ---
    const inDb = await t.db.query('SELECT title, completed FROM todos WHERE id = $1', [todo.id]);
    t.check(
      'Рядок реально з\'явився в таблиці, а не лише у відповіді',
      inDb.rows.length === 1 && inDb.rows[0].title === 'Купити хліб',
      `у базі за id ${todo.id}: ${JSON.stringify(inDb.rows)}\n` +
        'Відповідь 201 нічого не варта, якщо в таблиці порожньо.'
    );

    // --- id видає база ---
    const second = await t.api('POST', '/todos', { title: 'Другий', completed: true });
    t.check(
      `Другий POST отримав інший id (${todo.id} -> ${second.body && second.body.id})`,
      second.status === 201 && second.body.id !== todo.id,
      `а прийшло ${second.status}: ${second.text.slice(0, 160)}`
    );

    t.check(
      'completed: true зберігається як true',
      second.body && second.body.completed === true,
      `completed = ${JSON.stringify(second.body && second.body.completed)}`
    );

    // --- валідація ---
    const invalid = [
      { label: 'без title', body: { completed: false } },
      { label: 'title порожній', body: { title: '' } },
      { label: 'title числом', body: { title: 42 } },
      { label: 'completed рядком "true"', body: { title: 'Ок', completed: 'true' } },
      { label: 'completed числом 1', body: { title: 'Ок', completed: 1 } },
    ];

    for (const testCase of invalid) {
      const res = await t.api('POST', '/todos', testCase.body);
      t.check(
        `POST /todos (${testCase.label}) -> 400 і { error }`,
        res.status === 400 && res.body && typeof res.body.error === 'string',
        `а прийшло ${res.status}: ${res.text.slice(0, 140)}\n` +
          'Нагадування з таска 15: FastAPI сам віддав би 422 і detail —\n' +
          'наш контракт каже 400 і error.'
      );
    }

    const countBefore = await t.db.query('SELECT COUNT(*)::int AS n FROM todos');
    t.check(
      'Жоден відхилений запит не створив рядка в базі',
      countBefore.rows[0].n === 2,
      `у таблиці ${countBefore.rows[0].n} рядків замість 2.\n` +
        'Перевіряй ДО того, як писати в базу.'
    );

    // --- ін'єкція ---
    const attack = await t.api('POST', '/todos', { title: INJECTION });

    const tableAlive = await t.db.query("SELECT to_regclass('public.todos') AS t");
    t.check(
      'Після спроби ін\'єкції таблиця todos на місці',
      tableAlive.rows[0].t !== null,
      'ТАБЛИЦІ БІЛЬШЕ НЕМАЄ.\n' +
        'Отже, значення склеюється з текстом запиту, і база виконала те,\n' +
        'що прийшло в полі title, як команду. Це і є SQL-ін\'єкція.\n' +
        'Віднови таблицю (таск 19) і перепиши запити на %s з параметрами.'
    );

    if (tableAlive.rows[0].t !== null) {
      t.check(
        'Небезпечна назва збереглася дослівно, як звичайний текст',
        attack.status === 201 &&
          attack.body &&
          attack.body.title === INJECTION,
        `статус ${attack.status}, title у відповіді: ${JSON.stringify(
          attack.body && attack.body.title
        )}\n` +
          'Правильна поведінка — прийняти це як найзвичайнісінький рядок.'
      );

      const stored = await t.db.query('SELECT title FROM todos WHERE id = $1', [
        attack.body && attack.body.id,
      ]);
      t.check(
        'У базі лежить рівно той самий текст, нічого не "почистилось"',
        stored.rows.length === 1 && stored.rows[0].title === INJECTION,
        `у базі: ${JSON.stringify(stored.rows[0] && stored.rows[0].title)}\n` +
          'Екранувати або вирізати символи вручну не треба — це робота драйвера.'
      );

      const quoted = await t.api('POST', '/todos', { title: QUOTED });
      t.check(
        `Апостроф у назві не ламає запит ("${QUOTED}")`,
        quoted.status === 201 && quoted.body.title === QUOTED,
        `а прийшло ${quoted.status}: ${quoted.text.slice(0, 140)}\n` +
          'Це той самий механізм, просто без злого наміру: звичайне ім\'я\n' +
          'на кшталт O\'Brien ламає склеєний запит так само ефективно.'
      );
    }
  },

  explain: `
    Те, що ти щойно зробила, — найвідоміша вразливість в історії вебу.
    Вона в списку OWASP Top 10 десятиліттями, і досі ламає реальні системи.

    Як це працює. Якщо запит збирається склеюванням:

      f"INSERT INTO todos (title) VALUES ('{title}')"

    то title з апострофом усередині закриває рядок раніше, ніж задумано,
    і все, що далі, база читає вже як КОМАНДУ:

      INSERT INTO todos (title) VALUES ('Robert'); DROP TABLE todos; --')
                                               ^^ рядок закінчився тут
                                                  далі — нова команда
                                                                      ^^ решта
                                                                         закоментована

    База не винна: їй прийшов текст, вона чесно виконала те, що в ньому написано.
    Вона не може знати, яка частина тексту — твій запит, а яка — чужі дані,
    бо на момент, коли вона його бачить, це вже один суцільний рядок.

    Параметризований запит ламає саме це припущення. Драйвер відправляє окремо
    текст запиту (з %s на місці значень) і окремо самі значення. База спершу
    розбирає структуру команди, і лише потім підставляє дані у вже готові місця.
    Тому значення НЕ МОЖЕ стати командою — просто фізично немає моменту, коли
    вони були б одним текстом.

    Звідси правило, яке працює скрізь і завжди:

      дані користувача ніколи не стають частиною тексту запиту.

    І маленьке, але важливе: екранувати лапки руками НЕ ТРЕБА. Спокуса написати
    title.replace("'", "''") — це крок у неправильний бік. Ручне екранування
    завжди десь має дірку (інші лапки, юнікод, інша кодування), і воно псує дані:
    користувач з прізвищем O'Brien раптом стає O''Brien у базі. Параметри
    вирішують обидві проблеми одразу.

    І ще одна причина любити %s, зовсім не про безпеку: база кешує план виконання
    для запиту з параметрами. Склеєний запит щоразу новий текст — отже, щоразу
    новий розбір і новий план. Параметри ще й швидші.
  `,
};