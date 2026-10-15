'use strict';

/**
 * Таск 23 — фільтр, сортування і пагінація, зроблені базою.
 *
 * Той самий урок, що в таску 13, але тепер по-справжньому: там ми різали вже
 * завантажений масив, тут ми просимо базу віддати одразу рівно те, що треба.
 */

const TOTAL_ROWS = 25;
const COMPLETED_ROWS = 10;

module.exports = {
  id: '23',
  week: 3,
  type: 'code',
  title: 'Фільтр і пагінація в SQL',
  target: 'todo',

  brief: `
    Редагуєш файл:  todo-api/app.py

    GET /todos починає приймати параметри і віддавати конверт — так само,
    як GET /orders у таску 13:

      { "items": [...], "total": 25, "limit": 20, "offset": 0 }

      ?completed=true    тільки виконані
      ?completed=false   тільки невиконані
      без параметра      усі

      ?limit=   скільки віддати. Немає — 20. Ціле від 1 до 100.
      ?offset=  скільки пропустити. Немає — 0. Ціле від 0.

      ?completed=maybe, ?limit=abc, ?limit=0, ?limit=101, ?offset=-1  -> 400

      items    відсортовані за id
      total    скільки рядків ПІДХОДИТЬ ПІД ФІЛЬТР усього,
               а не скільки їх у цій порції

    Так, це ламаюча зміна: раніше GET /todos віддавав голий масив. Так буває —
    і саме тому зміни контракту прийнято помічати окремо.

    ── Головне в цьому таску ──

    Усе це робить БАЗА, а не Python. Тобто ось так робити НЕ треба:

      rows = conn.execute("SELECT * FROM todos").fetchall()     # усі 25
      rows = [r for r in rows if r["completed"]]                # фільтр у Python
      rows = rows[offset:offset + limit]                        # зріз у Python

    Поки рядків 25 — різниці не видно. Коли їх мільйон, такий код витягне
    мільйон рядків у пам'ять, щоб віддати двадцять.

    Треба так:

      SELECT * FROM todos WHERE completed = %s ORDER BY id LIMIT %s OFFSET %s

    А total рахується окремим запитом по тому самому фільтру:

      SELECT COUNT(*) FROM todos WHERE completed = %s

    Фільтр може бути, а може й не бути — збирай WHERE так само, як збирала
    SET у попередньому таску: списком шматків.
  `,

  async run(t) {
    await t.db.reset();

    // 25 рядків, з них 10 виконаних
    for (let i = 1; i <= TOTAL_ROWS; i += 1) {
      await t.db.query('INSERT INTO todos (title, completed) VALUES ($1, $2)', [
        `Завдання ${String(i).padStart(2, '0')}`,
        i <= COMPLETED_ROWS,
      ]);
    }
    t.info(`У базі ${TOTAL_ROWS} todo, з них ${COMPLETED_ROWS} виконаних\n`);

    const shapeOf = (res) => {
      const b = res.body;
      return b && Array.isArray(b.items) ? b : null;
    };

    // --- конверт і значення за замовчуванням ---
    const base = await t.api('GET', '/todos');
    const baseBody = shapeOf(base);

    t.check(
      'GET /todos -> конверт { items, total, limit, offset }',
      base.status === 200 &&
        baseBody !== null &&
        typeof baseBody.total === 'number' &&
        typeof baseBody.limit === 'number' &&
        typeof baseBody.offset === 'number',
      `а прийшло ${base.status}: ${base.text.slice(0, 180)}\n` +
        'Голий масив тут уже не підходить — потрібен конверт.'
    );

    if (!baseBody) return;

    t.check(
      `За замовчуванням limit = 20, offset = 0, items = 20, total = ${TOTAL_ROWS}`,
      baseBody.limit === 20 &&
        baseBody.offset === 0 &&
        baseBody.items.length === 20 &&
        baseBody.total === TOTAL_ROWS,
      `прийшло: items ${baseBody.items.length}, total ${baseBody.total}, ` +
        `limit ${baseBody.limit}, offset ${baseBody.offset}\n` +
        'total — це скільки рядків усього, а не скільки в цій порції.'
    );

    t.check(
      'items відсортовані за id',
      baseBody.items.every((todo, i) => i === 0 || baseBody.items[i - 1].id < todo.id),
      `порядок id: ${baseBody.items.map((x) => x.id).join(', ')}`
    );

    // --- limit / offset ---
    const limited = shapeOf(await t.api('GET', '/todos?limit=5'));
    t.check(
      `?limit=5 -> 5 рядків, але total усе одно ${TOTAL_ROWS}`,
      limited && limited.items.length === 5 && limited.total === TOTAL_ROWS,
      limited
        ? `items ${limited.items.length}, total ${limited.total}`
        : 'відповідь не того формату'
    );

    const lastPage = shapeOf(await t.api('GET', '/todos?offset=20'));
    t.check(
      '?offset=20 -> остання порція з 5 рядків',
      lastPage && lastPage.items.length === 5 && lastPage.items[0].id === 21,
      lastPage
        ? `items ${lastPage.items.length}, перший id ${lastPage.items[0] && lastPage.items[0].id}`
        : 'відповідь не того формату'
    );

    const beyond = await t.api('GET', '/todos?offset=999');
    const beyondBody = shapeOf(beyond);
    t.check(
      '?offset=999 (за межами) -> 200 і порожній items, а не 404',
      beyond.status === 200 &&
        beyondBody &&
        beyondBody.items.length === 0 &&
        beyondBody.total === TOTAL_ROWS,
      `а прийшло ${beyond.status}: ${beyond.text.slice(0, 160)}`
    );

    // --- фільтр ---
    const done = shapeOf(await t.api('GET', '/todos?completed=true'));
    t.check(
      `?completed=true -> ${COMPLETED_ROWS} рядків і total ${COMPLETED_ROWS}`,
      done &&
        done.items.length === COMPLETED_ROWS &&
        done.total === COMPLETED_ROWS &&
        done.items.every((todo) => todo.completed === true),
      done
        ? `items ${done.items.length}, total ${done.total}`
        : 'відповідь не того формату'
    );

    const notDone = shapeOf(await t.api('GET', '/todos?completed=false'));
    t.check(
      `?completed=false -> ${TOTAL_ROWS - COMPLETED_ROWS} рядків`,
      notDone &&
        notDone.total === TOTAL_ROWS - COMPLETED_ROWS &&
        notDone.items.every((todo) => todo.completed === false),
      notDone ? `total ${notDone.total}` : 'відповідь не того формату'
    );

    const combined = shapeOf(await t.api('GET', '/todos?completed=true&limit=3'));
    t.check(
      `?completed=true&limit=3 -> 3 рядки, total ${COMPLETED_ROWS} (а не ${TOTAL_ROWS})`,
      combined && combined.items.length === 3 && combined.total === COMPLETED_ROWS,
      combined
        ? `items ${combined.items.length}, total ${combined.total}\n` +
          'total рахується по тому самому фільтру, що й items.'
        : 'відповідь не того формату'
    );

    // --- невалідні параметри ---
    const invalid = [
      '?limit=abc',
      '?limit=0',
      '?limit=101',
      '?offset=-1',
      '?offset=abc',
      '?completed=maybe',
    ];

    for (const query of invalid) {
      const res = await t.api('GET', `/todos${query}`);
      t.check(
        `GET /todos${query} -> 400`,
        res.status === 400 && res.body && typeof res.body.error === 'string',
        `а прийшло ${res.status}: ${res.text.slice(0, 140)}`
      );
    }
  },

  explain: `
    Різниця між "відфільтрувати в SQL" і "відфільтрувати в Python" — це не
    питання смаку. Це питання того, чи працюватиме твій застосунок, коли даних
    стане багато.

    Порахуй, що відбувається на мільйоні рядків, якщо різати в Python:
    база читає мільйон рядків з диска, пересилає їх по мережі, Python збирає
    з них мільйон об'єктів у пам'яті — і викидає 999 980 з них, щоб віддати 20.
    На кожен запит. Від кожного користувача.

    А з LIMIT база знає, що треба 20, і зупиняється, щойно їх набрала.
    Особливо коли є індекс — тоді вона навіть не дивиться на решту.

    Правило, яке звідси випливає і працює завжди:

      фільтруй, сортуй і ріж там, де лежать дані, — а не там, де код.

    Чотири деталі, на яких тут спотикаються.

    1. total і len(items) — різні числа. total рахується ОКРЕМИМ запитом
       COUNT(*) по тому самому WHERE, але без LIMIT. Саме завдяки цьому клієнт
       може намалювати "сторінка 2 з 7". Якщо повернути len(items), конверт
       втрачає сенс — клієнт і так бачить, скільки йому прийшло.

    2. Верхня межа limit — це не причіпка, а захист. Без неї ?limit=10000000
       стає способом покласти сервер одним запитом. Будь-який параметр, що
       впливає на обсяг роботи, має стелю.

    3. Порожня сторінка — це 200 і порожній items. 404 означає "такої адреси
       немає", а не "за твоїм фільтром нічого не знайшлось". Той самий урок,
       що був у таску 07, просто в новому місці.

    4. OFFSET чесно працює, але має неприємну властивість: щоб віддати
       сторінку 1000, база спершу має пройти 20 000 рядків і викинути їх.
       На великих обсягах переходять на пагінацію "від останнього побаченого
       id" (WHERE id > 123 LIMIT 20). Тобі це поки не потрібно — просто знай,
       що таке буває і чому.

    І ще одне, що варто побачити на власні очі. Постав перед своїм запитом
    EXPLAIN і подивись, що відповість база:

      EXPLAIN SELECT * FROM todos WHERE completed = true ORDER BY id LIMIT 20;

    Вона покаже, як саме збирається виконувати запит: піде по всій таблиці
    (Seq Scan) чи скористається індексом (Index Scan). Поки що там буде Seq
    Scan — індексів у тебе немає. Це наступний таск.
  `,
};