'use strict';

/**
 * Таск 04 — шукаємо баг. Перший.
 *
 * У твоєму коді новий id рахується ось так:
 *
 *     const newUser = { id: users.length + 1, name, email };
 *
 * users.length — це КІЛЬКІСТЬ користувачів у масиві прямо зараз.
 * Поки нікого не видаляють, все чесно: було 3 — новому дамо 4.
 *
 * А тепер подумай: що буде, якщо СПОЧАТКУ когось видалити, а ПОТІМ створити?
 * Кількість зменшилась... а id-шники в тих, хто залишився, — ні.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Зробити так, щоб id ніколи не повторювався — ні в users, ні в todos
 * (у todos така сама формула todos.length + 1, і така сама проблема).
 *
 * Як саме — вирішуй сама. Підходить будь-який спосіб, аби перевірка позеленіла.
 * Якщо зовсім не знаєш, з чого почати, ідеї є в поясненні наприкінці таска —
 * але спершу спробуй придумати сама.
 */

module.exports = {
  id: '04',
  type: 'code',
  title: 'Баг: id, що повторюється',

  brief: `
    Редагуєш файл:  index.js

    Зараз новий id рахується так:  id: users.length + 1
    Тобто по КІЛЬКОСТІ користувачів у масиві.

    Уяви: спочатку когось видалили, потім створили нового. Кількість
    зменшилась — а id у тих, хто залишився, ні. Що вийде?

    Завдання: зробити так, щоб id ніколи не повторювались — і в users,
    і в todos (там така сама формула). Спосіб обирай сама.
  `,

  async run(t) {
    const before = (await t.api('GET', '/users')).body;
    const idsBefore = before.map((u) => u.id);
    t.info(`На старті маємо користувачів з id = [${idsBefore.join(', ')}]`);

    const deleted = await t.api('DELETE', '/users/1');
    t.check('DELETE /users/1 відповідає 204', deleted.status === 204, `а відповів ${deleted.status}`);

    const created = await t.api('POST', '/users', {
      name: 'Fresh',
      email: 'fresh@example.com',
    });
    t.check('POST /users відповідає 201', created.status === 201, `а відповів ${created.status}`);

    const newId = created.body && created.body.id;
    const survivors = (await t.api('GET', '/users')).body.filter((u) => u.name !== 'Fresh');
    const survivorIds = survivors.map((u) => u.id);

    t.info(`Після видалення лишились id = [${survivorIds.join(', ')}], а новому дали id = ${newId}`);

    t.check(
      'Новий користувач отримав id, якого ще ні в кого немає',
      !survivorIds.includes(newId),
      `id ${newId} уже зайнятий — він є в іншого користувача.\n` +
        'Чому так вийшло: users.length + 1 рахує КІЛЬКІСТЬ у масиві, а не найбільший\n' +
        'виданий id. Після видалення кількість зменшилась — і лічильник пішов по колу.'
    );

    const fetched = await t.api('GET', `/users/${newId}`);
    t.check(
      `GET /users/${newId} віддає саме Fresh, а не чужого користувача`,
      fetched.status === 200 && fetched.body && fetched.body.name === 'Fresh',
      `а віддав ось це: ${JSON.stringify(fetched.body)}\n` +
        'Це і є наслідок однакових id: find() зупиняється на ПЕРШОМУ, хто збігся,\n' +
        'а перший — це старий користувач.'
    );

    // Створюємо трьох поспіль — усі id мають бути різні.
    const batch = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await t.api('POST', '/users', { name: `U${i}`, email: `u${i}@example.com` });
      batch.push(res.body && res.body.id);
    }
    t.check(
      `Три нові користувачі отримали три різні id (${batch.join(', ')})`,
      new Set(batch).size === 3 && !batch.some((id) => survivorIds.includes(id)),
      'Серед виданих id є однакові.'
    );

    // Та сама помилка живе і в todos.
    await t.api('DELETE', '/todos/1');
    const newTodo = await t.api('POST', '/todos', { title: 'Fresh todo' });
    const todos = (await t.api('GET', '/todos')).body;
    const todoIds = todos.map((todo) => todo.id);
    t.check(
      `У todos теж немає однакових id (зараз: ${todoIds.join(', ')})`,
      new Set(todoIds).size === todoIds.length,
      `новий todo отримав id ${newTodo.body && newTodo.body.id}, а такий уже є.\n` +
        'У todos така сама формула todos.length + 1 — полагодь і там.'
    );
  },

  explain: `
    Суть бага: ми рахували одне, а потрібно було зовсім інше. Кількість елементів
    у масиві та найбільший виданий id — це два різні числа, і після першого ж
    видалення вони розходяться.

    Найгірше тут не сама помилка, а те, як вона поводиться. Нічого не падає,
    ніяких червоних повідомлень. Просто одного дня GET /users/3 віддає не того
    користувача, і ти довго не розумієш чому. Такі "тихі" баги знаходити
    найважче.

    Робочі варіанти фіксу (будь-який годиться):
      1) окрема змінна-лічильник, яка тільки росте і ніколи не зменшується:
           let nextUserId = 4;
           const newUser = { id: nextUserId++, ... };
      2) взяти найбільший існуючий id і додати одиницю:
           const id = Math.max(...users.map(u => u.id), 0) + 1;
      3) видати випадковий унікальний id: crypto.randomUUID()

    А в справжніх проєктах цим взагалі займається база даних: там у колонки id
    є режим "рахуй сам" (автоінкремент), саме щоб такий код не писали руками.
  `,
};
