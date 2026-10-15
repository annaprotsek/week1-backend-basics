'use strict';

/**
 * Таск 22 — зміна і видалення на базі.
 *
 * Головна ідея: база сама знає, чи існував рядок. Окремий SELECT "а чи є такий"
 * перед UPDATE не потрібен — UPDATE і сам скаже, скільки рядків він зачепив.
 */

module.exports = {
  id: '22',
  week: 3,
  type: 'code',
  title: 'PATCH і DELETE на базі',
  target: 'todo',

  brief: `
    Редагуєш файл:  todo-api/app.py

    Два нових endpoint'и.

      PATCH /todos/{id}   тіло: будь-яка комбінація { title, completed }
                          немає такого id      -> 404 і { error }
                          невалідні дані       -> 400, у базі нічого не змінилось
                          порожнє тіло {}      -> 200 і рядок як був
                          все добре            -> 200 і оновлений рядок

      DELETE /todos/{id}  знайшовся    -> 204 і порожня відповідь
                          не знайшовся -> 404 і { error }

    Правила полів ті самі, що в POST: title — непорожній текст,
    completed — саме boolean.

    Міняються ТІЛЬКИ title і completed. id, created_at і будь-що інше з тіла
    запиту до бази потрапити не має — урок із таска 10.

    Як дізнатись, що рядка не існує, НЕ роблячи зайвого SELECT:

      row = conn.execute(
          "UPDATE todos SET completed = %s WHERE id = %s RETURNING *",
          [completed, todo_id],
      ).fetchone()
      if row is None:
          ...  # такого рядка не було -> 404

    Тобто сам UPDATE повертає те, що змінив. Нічого не змінив — повернув порожньо.
    З DELETE так само: DELETE ... RETURNING id.

    Складність тут одна: полів може прийти одне, два або жодного, а запит
    треба зібрати під те, що реально прислали. Робиться це списком шматків:

      sets, params = [], []
      if title is not None:
          sets.append("title = %s"); params.append(title)
      ...
      "UPDATE todos SET " + ", ".join(sets) + " WHERE id = %s RETURNING *"

    Імена колонок складаються з ТВОГО коду, а не з даних користувача —
    значення, як і раніше, йдуть тільки через %s.
  `,

  async run(t) {
    await t.db.reset();
    await t.db.query(
      `INSERT INTO todos (title, completed) VALUES
         ('Перший', false), ('Другий', false), ('Третій', true)`
    );

    // --- PATCH, успішні випадки ---
    const patched = await t.api('PATCH', '/todos/1', { completed: true });
    t.check(
      'PATCH /todos/1 { completed: true } -> 200 і оновлений рядок',
      patched.status === 200 && patched.body && patched.body.completed === true,
      `а прийшло ${patched.status}: ${patched.text.slice(0, 160)}`
    );

    const inDb = await t.db.query('SELECT title, completed FROM todos WHERE id = 1');
    t.check(
      'Зміна справді записалась у базу, а title не зачеплений',
      inDb.rows[0].completed === true && inDb.rows[0].title === 'Перший',
      `у базі зараз: ${JSON.stringify(inDb.rows[0])}\n` +
        'Якщо title став порожнім — ти перезаписуєш поля, яких у запиті не було.'
    );

    const renamed = await t.api('PATCH', '/todos/2', { title: 'Перейменований' });
    const renamedDb = await t.db.query('SELECT title, completed FROM todos WHERE id = 2');
    t.check(
      'PATCH з одним лише title міняє назву і не чіпає completed',
      renamed.status === 200 &&
        renamedDb.rows[0].title === 'Перейменований' &&
        renamedDb.rows[0].completed === false,
      `у базі зараз: ${JSON.stringify(renamedDb.rows[0])}`
    );

    const empty = await t.api('PATCH', '/todos/3', {});
    const emptyDb = await t.db.query('SELECT title, completed FROM todos WHERE id = 3');
    t.check(
      'PATCH з порожнім тілом {} -> 200 і рядок без змін (це не помилка)',
      empty.status === 200 &&
        emptyDb.rows[0].title === 'Третій' &&
        emptyDb.rows[0].completed === true,
      `а прийшло ${empty.status}, у базі: ${JSON.stringify(emptyDb.rows[0])}\n` +
        '"Нічого не змінилось" — цілком нормальний результат.\n' +
        'Обережно з UPDATE без жодного SET — такий запит просто не збереться.'
    );

    // --- PATCH, помилки ---
    const badType = await t.api('PATCH', '/todos/1', { completed: 'yes' });
    const afterBad = await t.db.query('SELECT completed FROM todos WHERE id = 1');
    t.check(
      'PATCH з completed: "yes" -> 400, і в базі нічого не змінилось',
      badType.status === 400 &&
        badType.body &&
        typeof badType.body.error === 'string' &&
        afterBad.rows[0].completed === true,
      `статус ${badType.status}, у базі completed = ${afterBad.rows[0].completed}`
    );

    const emptyTitle = await t.api('PATCH', '/todos/1', { title: '' });
    t.check(
      'PATCH з порожнім title -> 400',
      emptyTitle.status === 400,
      `а прийшло ${emptyTitle.status}: ${emptyTitle.text.slice(0, 140)}`
    );

    const missing = await t.api('PATCH', '/todos/9999', { completed: true });
    t.check(
      'PATCH неіснуючого id -> 404 і { error }',
      missing.status === 404 && missing.body && typeof missing.body.error === 'string',
      `а прийшло ${missing.status}: ${missing.text.slice(0, 140)}\n` +
        'Якщо тут 200 — ти не перевіряєш, що UPDATE нічого не зачепив.'
    );

    const sneaky = await t.api('PATCH', '/todos/3', {
      id: 777,
      created_at: '1999-01-01T00:00:00Z',
      title: 'Чужі поля',
    });
    const sneakyDb = await t.db.query('SELECT id, title FROM todos WHERE id = 3');
    t.check(
      'Чужі поля (id, created_at) з тіла запиту ігноруються',
      sneaky.status === 200 &&
        sneakyDb.rows.length === 1 &&
        sneakyDb.rows[0].id === 3 &&
        sneakyDb.rows[0].title === 'Чужі поля',
      `статус ${sneaky.status}, у базі: ${JSON.stringify(sneakyDb.rows)}\n` +
        'Дозволені до зміни поля перелічуються явно — беремо зі списку,\n' +
        'а не те, що прийшло.'
    );

    // --- DELETE ---
    const removed = await t.api('DELETE', '/todos/2');
    t.check(
      'DELETE існуючого -> 204 і порожня відповідь',
      removed.status === 204 && removed.text.length === 0,
      `а прийшло ${removed.status}, тіло: "${removed.text.slice(0, 80)}"`
    );

    const gone = await t.db.query('SELECT 1 FROM todos WHERE id = 2');
    t.check(
      'Рядок справді зник з таблиці',
      gone.rows.length === 0,
      'У базі він усе ще є — значить, DELETE до неї не дійшов.'
    );

    const again = await t.api('DELETE', '/todos/2');
    t.check(
      'Повторний DELETE того самого id -> 404',
      again.status === 404,
      `а прийшло ${again.status}\n` +
        'Перший раз рядок був, другий — уже ні. Відповідь має це відображати.'
    );

    const rest = await t.db.query('SELECT COUNT(*)::int AS n FROM todos');
    t.check(
      'Решта рядків на місці — видалився рівно один',
      rest.rows[0].n === 2,
      `у таблиці лишилось ${rest.rows[0].n} рядків замість 2.\n` +
        'DELETE без WHERE прибирає ВСЮ таблицю. Перевір умову.'
    );
  },

  explain: `
    Головне, що тут змінилось у способі думати: більше не треба питати базу
    двічі.

    Звична схема з масивом була такою: спочатку знайти елемент, перевірити що
    він є, потім змінити. З базою спокуса зробити так само — SELECT, перевірка,
    UPDATE. Але це два походи в базу замість одного, та ще й з діркою посередині:
    між SELECT і UPDATE рядок може зникнути (його видалить інший запит), і твоя
    перевірка виявиться брехнею.

    UPDATE ... RETURNING вирішує обидві проблеми. Він міняє і одразу каже, що
    саме змінив. Нічого не повернув — рядка не було. Одна операція, один похід,
    ніякої щілини між перевіркою і дією.

    Три речі, на яких тут спотикаються.

    1. UPDATE без жодного SET — це синтаксична помилка. Коли прийшло порожнє
       тіло, запит просто нема з чого зібрати. Тому порожній PATCH обробляють
       окремо: нічого не міняємо, повертаємо рядок як є.

    2. UPDATE і DELETE без WHERE зачіпають УСЮ таблицю. Це найдорожча помилка
       в роботі з базою, і робили її всі. Звідси корисна звичка: спершу напиши
       SELECT з тим самим WHERE, подивись, скільки рядків він вибрав, і лише
       потім міняй SELECT на UPDATE.

    3. Список дозволених полів складає твій код. Побудувати SET з того, що
       прийшло в тілі, — спокусливо (менше коду!), але це та сама дірка, що й
       Object.assign у таску 10: клієнт дописує собі поле, про яке ти не думала.
       Імена колонок — завжди з твого коду; з даних користувача — тільки
       значення, і тільки через %s.

    І маленьке спостереження наостанок. Подивись на свій app.py: там більше
    немає жодного пошуку по масиву, жодного splice, жодної перевірки "а чи є
    такий індекс". Усе це робить база, причому надійніше. Код застосунку звівся
    до того, чим він і має бути: прийняти запит, перевірити вхідні дані,
    сходити в базу, повернути відповідь.
  `,
};