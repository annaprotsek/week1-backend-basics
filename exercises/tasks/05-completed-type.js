'use strict';

/**
 * Таск 05 — шукаємо баг. Другий.
 *
 * Подивись на два свої handler'и поруч.
 *
 * У POST:
 *     completed: Boolean(completed)
 *   Boolean(...) перетворює будь-що на true або false. Boolean("yes") дає true,
 *   Boolean("") дає false. Тобто тут значення завжди стає true/false.
 *
 * У PUT:
 *     if (completed !== undefined) todo.completed = completed;
 *   А тут значення записується ЯК Є, без перетворення.
 *
 * Що з цього виходить: надішли PUT з { "completed": "false" } — і в масиві
 * опиниться ТЕКСТ "false", а не значення false. Для JavaScript будь-який
 * непорожній текст — це "правда", тому такий todo вважатиметься виконаним.
 * А фільтр GET /todos?completed=false його вже не знайде, бо там порівняння
 * саме зі значенням false, а не з текстом.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Замість тихого перетворення — чесна перевірка. Правила:
 *
 *   1. POST /todos без поля completed          -> 201, completed = false
 *   2. POST /todos з completed: true           -> 201, completed = true
 *   3. POST /todos з completed: "yes"          -> 400 і { error: "..." }
 *   4. PUT  /todos/:id з completed: false      -> 200, completed = false
 *   5. PUT  /todos/:id з completed: "false"    -> 400 і { error: "..." }
 *
 * Текст помилки пиши який хочеш, головне щоб поле називалось error —
 * так само, як у решті твоїх endpoint'ів.
 *
 * Підказка: перевірити тип можна так -> typeof completed !== 'boolean'
 */

module.exports = {
  id: '05',
  type: 'code',
  title: 'Баг: тип поля completed',

  brief: `
    Редагуєш файл:  index.js

    POST /todos перетворює completed на true/false, а PUT /todos/:id — ні.
    Через це в масив може потрапити ТЕКСТ "false" замість значення false.

    Додай чесну перевірку типу в обидва handler'и, щоб вийшло так:

      POST без completed        -> 201, completed = false
      POST completed: true      -> 201, completed = true
      POST completed: "yes"     -> 400 і { error: "..." }
      PUT  completed: false     -> 200, completed = false
      PUT  completed: "false"   -> 400 і { error: "..." }

    Підказка:  typeof completed !== 'boolean'
  `,

  async run(t) {
    const withoutFlag = await t.api('POST', '/todos', { title: 'Без прапорця' });
    t.check(
      'POST /todos без completed -> 201, а completed стає false',
      withoutFlag.status === 201 && withoutFlag.body && withoutFlag.body.completed === false,
      `а прийшло ${withoutFlag.status}, completed = ${JSON.stringify(
        withoutFlag.body && withoutFlag.body.completed
      )}`
    );

    const withFlag = await t.api('POST', '/todos', { title: 'З прапорцем', completed: true });
    t.check(
      'POST /todos з completed: true -> 201, completed = true',
      withFlag.status === 201 && withFlag.body && withFlag.body.completed === true,
      `а прийшло ${withFlag.status}, completed = ${JSON.stringify(
        withFlag.body && withFlag.body.completed
      )}`
    );

    const badPost = await t.api('POST', '/todos', { title: 'Кривий тип', completed: 'yes' });
    t.check(
      'POST /todos з completed: "yes" -> 400',
      badPost.status === 400 && badPost.body && typeof badPost.body.error === 'string',
      `а прийшло ${badPost.status}, відповідь: ${badPost.text.slice(0, 120)}\n` +
        'Зараз Boolean("yes") тихо перетворює це на true — і той, хто надіслав\n' +
        'запит, ніколи не дізнається, що написав дурницю.'
    );

    const goodPut = await t.api('PUT', '/todos/1', { completed: false });
    t.check(
      'PUT /todos/1 з completed: false -> 200, і це саме значення false, не текст',
      goodPut.status === 200 &&
        goodPut.body &&
        goodPut.body.completed === false &&
        typeof goodPut.body.completed === 'boolean',
      `а прийшло ${goodPut.status}, completed = ${JSON.stringify(
        goodPut.body && goodPut.body.completed
      )} (тип: ${goodPut.body && typeof goodPut.body.completed})`
    );

    const badPut = await t.api('PUT', '/todos/1', { completed: 'false' });
    t.check(
      'PUT /todos/1 з completed: "false" -> 400',
      badPut.status === 400 && badPut.body && typeof badPut.body.error === 'string',
      `а прийшло ${badPut.status}, відповідь: ${badPut.text.slice(0, 120)}`
    );

    const afterBadPut = await t.api('GET', '/todos/1');
    t.check(
      'Після відхиленого PUT дані в todo лишились цілими',
      afterBadPut.status === 200 &&
        afterBadPut.body &&
        typeof afterBadPut.body.completed === 'boolean',
      `зараз completed = ${JSON.stringify(
        afterBadPut.body && afterBadPut.body.completed
      )} (тип: ${afterBadPut.body && typeof afterBadPut.body.completed})\n` +
        'Перевіряй ДО того, як щось міняти. Інакше вийде смішне: сервер відповів\n' +
        '"400, не приймаю", а дані вже зіпсував.'
    );

    const doneOnly = (await t.api('GET', '/todos?completed=true')).body;
    t.check(
      'GET /todos?completed=true віддає тільки справді виконані',
      Array.isArray(doneOnly) && doneOnly.every((todo) => todo.completed === true),
      `а у відповіді є щось зайве: ${JSON.stringify(doneOnly)}`
    );
  },

  explain: `
    Головна ідея називається "перевіряти на вході". Все, що прийшло ззовні —
    body, query, params — вважається брудним, поки ти його не перевірила.
    Перевірка робиться ОДИН раз, на самому початку handler'а. Далі код уже
    спокійно працює зі своїми даними і не перепитує "а раптом там текст?".

    Чому це важливо саме в JavaScript: він дуже не любить скаржитись.
    Boolean("yes") дасть true. Boolean("false") теж дасть true (бо це непорожній
    текст!). Number("abc") дасть NaN. Нічого не падає, ніхто не попереджає —
    просто далі в програмі живе неправильне значення, і через два екрани коду
    щось працює дивно.

    Тому краще голосна помилка 400 прямо зараз, ніж тихе сміття в даних потім.

    І другий рефлекс, який варто виробити: спершу ПЕРЕВІР усе, і лише потім
    МІНЯЙ. Якщо міняти по дорозі, можна відповісти "400, відмовляю" і при цьому
    вже встигнути зіпсувати половину полів.
  `,
};
