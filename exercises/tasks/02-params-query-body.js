'use strict';

/**
 * Таск 02 — три місця, звідки приходять дані: params, query, body.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Додай у index.js новий endpoint:  POST /debug/echo/:id
 *
 * Він нічого не зберігає і нічого не шукає. Він просто бере три речі, які
 * Express поклав у req, і віддає їх назад, щоб ти побачила їх на власні очі:
 *
 *   res.json({
 *     params: req.params,   // те, що було в самій адресі: /debug/echo/15
 *     query:  req.query,    // те, що було після знака "?"
 *     body:   req.body      // те, що прийшло в тілі запиту (JSON)
 *   });
 *
 * Статус — звичайний 200 (res.json сам його ставить, писати нічого не треба).
 *
 * ЯК ПЕРЕВІРИТЬСЯ
 *
 * Перевірка надішле ось такий запит:
 *
 *   POST /debug/echo/15?active=true&tag=shop
 *   тіло: { "name": "Anna", "age": 30 }
 *
 * і подивиться, чи всі три частини опинились там, де мають.
 */

module.exports = {
  id: '02',
  type: 'code',
  title: 'params / query / body',

  brief: `
    Редагуєш файл:  index.js

    Додай новий endpoint  POST /debug/echo/:id
    Він нічого не зберігає — просто віддає назад три речі, які Express
    поклав у req, щоб ти побачила їх на власні очі:

      app.post('/debug/echo/:id', (req, res) => {
        res.json({ params: req.params, query: req.query, body: req.body });
      });

    Перевірка надішле POST /debug/echo/15?active=true&tag=shop
    з тілом { "name": "Anna", "age": 30 } — і подивиться, чи всі три
    частини опинились там, де мають.
  `,

  async run(t) {
    const res = await t.api('POST', '/debug/echo/15?active=true&tag=shop', {
      name: 'Anna',
      age: 30,
    });

    if (res.status === 404) {
      t.blocked(
        'Endpoint POST /debug/echo/:id ще не існує — сервер відповів 404.\n' +
          '    Що саме треба додати, написано зверху файлу\n' +
          '    exercises/tasks/02-params-query-body.js'
      );
    }

    t.check('Відповідає статусом 200', res.status === 200, `а відповів ${res.status}`);

    const payload = res.body || {};
    const { params, query, body } = payload;

    t.check(
      'У відповіді є всі три частини: params, query, body',
      params !== undefined && query !== undefined && body !== undefined,
      `а прийшли тільки: ${Object.keys(payload).join(', ') || '(нічого)'}`
    );

    t.check(
      'params.id дорівнює 15 — це шматок адреси /debug/echo/15',
      params && params.id == 15,
      `params = ${JSON.stringify(params)}`
    );

    t.check(
      'params.id — це текст "15", а не число 15',
      params && typeof params.id === 'string',
      'Все, що приходить в адресі, Express віддає ТЕКСТОМ. Саме тому в твоєму\n' +
        '/users/:id стоїть Number(req.params.id) — без нього порівняння не спрацює.\n' +
        `зараз typeof params.id = ${params && typeof params.id}`
    );

    t.check(
      'query містить active і tag — те, що стояло після "?"',
      query && query.active === 'true' && query.tag === 'shop',
      `query = ${JSON.stringify(query)}`
    );

    t.check(
      'body містить name і age — те, що прийшло в тілі запиту',
      body && body.name === 'Anna' && body.age === 30,
      `body = ${JSON.stringify(body)}\n` +
        'Якщо тут undefined — перевір, що вище в файлі є рядок app.use(express.json()).'
    );
  },

  explain: `
    Дані приїжджають у запит трьома різними дорогами, і плутати їх не можна:

      /users/:id     ->  req.params  ->  ЯКУ САМЕ річ ми беремо
      ?active=true   ->  req.query   ->  ЯК її віддати: фільтр, сортування, сторінка
      тіло запиту    ->  req.body    ->  САМІ ДАНІ, які ми створюємо або міняємо

    Приклад, щоб відчути різницю:
      /users/15            — дай мені користувача номер 15
      /users?role=admin    — дай мені список, але тільки адмінів

    Важливо про типи. params і query — ЗАВЖДИ текст: '15', 'true'. Навіть якщо
    виглядає як число. Тому ось це не знайде нічого ніколи:

      users.find(u => u.id === req.params.id)   // 1 === '1'  ->  false

    Потрібно Number(req.params.id) — саме це в тебе вже і написано.

    І останнє: req.body існує тільки завдяки рядку app.use(express.json()).
    Це так званий middleware — "проміжна" функція, яка встигає подивитись на
    запит РАНІШЕ за твій handler. Вона читає тіло запиту (а воно приходить
    просто набором символів) і перетворює його на нормальний об'єкт JavaScript.
    Приберемо цей рядок — req.body стане undefined, і код зламається.
  `,
};
