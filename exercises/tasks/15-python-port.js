'use strict';

/**
 * Таск 15 — той самий API, інша мова.
 *
 * Це не "вивчити Python". Це перевірка однієї думки, яка потім тримає всю
 * роботу бекендера: КОНТРАКТ НЕ ЗАЛЕЖИТЬ ВІД МОВИ. Ті самі адреси, ті самі
 * статуси, ті самі тіла — а всередині може бути що завгодно.
 *
 * Доказ буде буквальний: ті самі перевірки, які ти проходила на Node,
 * проженуться проти Python-сервера і мають позеленіти так само.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Написати python/app.py — FastAPI-застосунок, який відповідає рівно так само,
 * як твій index.js. Як поставити оточення і з чого почати — у python/README.md.
 *
 * Дві речі, які здивують одразу (і це добре — це і є урок):
 *
 *   1. Валідацію більше не пишуть руками. У Python є pydantic: ти описуєш
 *      СХЕМУ даних, а перевірки з неї беруться самі. Половина коду, який ти
 *      писала в тасках 05, 06, 10 і 12, тут перетворюється на кілька рядків.
 *
 *   2. Але з коробки FastAPI на невалідне тіло відповідає 422, а наш контракт
 *      каже 400. І тут не фреймворк вирішує, а контракт: доведеться перехопити
 *      помилку валідації й привести відповідь до нашої форми { "error": "..." }.
 *      Це нормальна робота, а не боротьба з інструментом.
 *
 * ЯК ПЕРЕВІРЯТИ
 *
 *   node exercises/run.js 15              — швидка перевірка контракту (цей таск)
 *   node exercises/run.js --all --target=python
 *                                         — УСІ таски проти Python-сервера
 *
 * Другу команду і вважаємо фінішем.
 */

const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../lib/harness');

const APP_FILE = path.join(PROJECT_ROOT, 'python', 'app.py');

module.exports = {
  id: '15',
  type: 'code',
  title: 'Той самий API на Python (FastAPI)',

  // Сервер піднімаємо самі — і не Node, а Python.
  needsServer: false,

  brief: `
    Створюєш файл:  python/app.py   (index.js не чіпаєш узагалі)

    Перепиши той самий API на FastAPI: ті самі адреси, ті самі статуси,
    ті самі тіла відповідей. Перевірки — ті самі, що й були.

    Як поставити оточення і з чого почати — у python/README.md

    Два сюрпризи, до яких варто бути готовою:
      - валідацію не пишуть руками, її описують схемою (pydantic);
      - FastAPI за замовчуванням віддає 422 на невалідне тіло, а наш
        контракт каже 400 — доведеться перехопити й привести до нашої форми.

    Перевірка:
      node exercises/run.js 15                      — швидкий прогін контракту
      node exercises/run.js --all --target=python   — УСІ таски проти Python
  `,

  async run(t) {
    if (!fs.existsSync(APP_FILE)) {
      t.blocked(
        'Файлу python/app.py ще немає.\n' +
          '    Це додатковий таск: той самий API, переписаний на FastAPI.\n' +
          '    З чого почати — у python/README.md'
      );
    }

    await t.useTarget('python');
    t.info('Сервер піднято з python/app.py. Далі — рівно ті самі перевірки.\n');

    // --- базове ---
    const hello = await t.api('GET', '/hello');
    t.check(
      'GET /hello -> 200 і { message: "Hello, World!" }',
      hello.status === 200 && hello.body && hello.body.message === 'Hello, World!',
      `а прийшло ${hello.status}: ${hello.text.slice(0, 120)}`
    );

    // --- users ---
    const users = await t.api('GET', '/users');
    t.check(
      'GET /users -> 200 і ті самі три користувачі, що в index.js',
      users.status === 200 &&
        Array.isArray(users.body) &&
        users.body.length === 3 &&
        users.body[0].name === 'Anna',
      `а прийшло ${users.status}: ${users.text.slice(0, 140)}\n` +
        'Стартові дані мають збігатися: Anna, Bohdan, Olena.'
    );

    const oneUser = await t.api('GET', '/users/2');
    t.check(
      'GET /users/2 -> 200 і Bohdan',
      oneUser.status === 200 && oneUser.body && oneUser.body.name === 'Bohdan',
      `а прийшло ${oneUser.status}: ${oneUser.text.slice(0, 120)}`
    );

    const noUser = await t.api('GET', '/users/999');
    t.check(
      'GET /users/999 -> 404 і { error }',
      noUser.status === 404 && noUser.body && typeof noUser.body.error === 'string',
      `а прийшло ${noUser.status}: ${noUser.text.slice(0, 120)}\n` +
        'FastAPI за замовчуванням кладе текст помилки в поле "detail".\n' +
        'Наш контракт каже "error" — значить, треба своя відповідь.'
    );

    const newUser = await t.api('POST', '/users', { name: 'Fresh', email: 'fresh@example.com' });
    t.check(
      'POST /users -> 201 і створений користувач з id',
      newUser.status === 201 && newUser.body && newUser.body.id !== undefined,
      `а прийшло ${newUser.status}: ${newUser.text.slice(0, 120)}\n` +
        'У FastAPI статус задається так: @app.post("/users", status_code=201)'
    );

    const badUser = await t.api('POST', '/users', { name: 'No email' });
    t.check(
      'POST /users без email -> 400 (а не 422, як FastAPI хоче за замовчуванням)',
      badUser.status === 400 && badUser.body && typeof badUser.body.error === 'string',
      `а прийшло ${badUser.status}: ${badUser.text.slice(0, 140)}\n` +
        'Якщо тут 422 — саме про це й був другий сюрприз. Потрібен свій\n' +
        'обробник RequestValidationError, який віддає нашу форму { error }.'
    );

    const deleted = await t.api('DELETE', '/users/3');
    t.check(
      'DELETE /users/3 -> 204 і порожнє тіло',
      deleted.status === 204 && deleted.text.length === 0,
      `а прийшло ${deleted.status}, у тілі: "${deleted.text.slice(0, 80)}"\n` +
        'У FastAPI: @app.delete("/users/{user_id}", status_code=204) + Response(status_code=204)'
    );

    // --- todos ---
    const doneTodos = await t.api('GET', '/todos?completed=true');
    t.check(
      'GET /todos?completed=true -> 200 і тільки виконані',
      doneTodos.status === 200 &&
        Array.isArray(doneTodos.body) &&
        doneTodos.body.every((todo) => todo.completed === true),
      `а прийшло ${doneTodos.status}: ${doneTodos.text.slice(0, 140)}`
    );

    const badTodo = await t.api('POST', '/todos', { title: 'Кривий тип', completed: 'yes' });
    t.check(
      'POST /todos з completed: "yes" -> 400 (урок з таска 05)',
      badTodo.status === 400,
      `а прийшло ${badTodo.status}: ${badTodo.text.slice(0, 140)}\n` +
        'Увага: pydantic за замовчуванням уміє перетворювати "yes" на True.\n' +
        'Нам це не підходить — тип має бути суворим (StrictBool).'
    );

    // --- products ---
    const product = await t.api('POST', '/products', { name: 'Laptop', price: 1200 });
    t.check(
      'POST /products -> 201 із заголовком Location (урок з таска 11)',
      product.status === 201 &&
        typeof product.headers.location === 'string' &&
        product.headers.location.includes('/products/'),
      `а прийшло ${product.status}, Location = ${product.headers.location || '(немає)'}`
    );

    const duplicate = await t.api('POST', '/products', { name: 'LAPTOP', price: 10 });
    t.check(
      'POST /products з тією самою назвою -> 409',
      duplicate.status === 409,
      `а прийшло ${duplicate.status}: ${duplicate.text.slice(0, 120)}`
    );

    await t.api('POST', '/products', { name: 'Mouse', price: 25 });
    const filtered = await t.api('GET', '/products?maxPrice=100&search=ou');
    t.check(
      'GET /products?maxPrice=100&search=ou -> тільки Mouse (урок з таска 07)',
      filtered.status === 200 &&
        Array.isArray(filtered.body) &&
        filtered.body.length === 1 &&
        filtered.body[0].name === 'Mouse',
      `а прийшло ${filtered.status}: ${filtered.text.slice(0, 140)}`
    );

    const patched = await t.api('PATCH', `/products/${product.body.id}`, { price: 999 });
    t.check(
      'PATCH /products/:id міняє тільки ціну (урок з таска 10)',
      patched.status === 200 && patched.body && patched.body.price === 999 && patched.body.name === 'Laptop',
      `а прийшло ${patched.status}: ${patched.text.slice(0, 140)}`
    );

    // --- orders ---
    const order = await t.api('POST', '/orders', {
      customer: 'Anna',
      items: [{ productId: product.body.id, qty: 2, price: 1 }],
    });
    t.check(
      'POST /orders -> 201, total рахує сервер: 2 * 999 = 1998 (урок з таска 12)',
      order.status === 201 && order.body && order.body.total === 1998,
      `а прийшло ${order.status}: ${order.text.slice(0, 160)}\n` +
        'price з тіла запиту ігнорується, ціна береться з products.'
    );

    const badOrder = await t.api('POST', '/orders', {
      customer: 'Anna',
      items: [
        { productId: product.body.id, qty: 1 },
        { productId: product.body.id, qty: 0 },
      ],
    });
    t.check(
      'POST /orders з qty: 0 у другій позиції -> 400 і items[1] у тексті помилки',
      badOrder.status === 400 && badOrder.body && String(badOrder.body.error).includes('items[1]'),
      `а прийшло ${badOrder.status}: ${badOrder.text.slice(0, 160)}`
    );

    const ordersList = await t.api('GET', '/orders?limit=1');
    t.check(
      'GET /orders?limit=1 -> конверт { items, total, limit, offset } (урок з таска 13)',
      ordersList.status === 200 &&
        ordersList.body &&
        Array.isArray(ordersList.body.items) &&
        ordersList.body.items.length === 1 &&
        ordersList.body.limit === 1,
      `а прийшло ${ordersList.status}: ${ordersList.text.slice(0, 160)}`
    );

    // --- помилки (урок з таска 09) ---
    const unknown = await t.api('GET', '/this-route-does-not-exist');
    t.check(
      'GET /неіснуюче -> 404 і { error } у JSON',
      unknown.status === 404 && unknown.body && typeof unknown.body.error === 'string',
      `а прийшло ${unknown.status}: ${unknown.text.slice(0, 140)}\n` +
        'FastAPI сам віддає JSON, але з полем "detail" — приводь до нашого "error".'
    );

    const brokenJson = await t.send('POST', '/users', {
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{"name": ',
    });
    t.check(
      'POST /users з поламаним JSON -> 400 і { error } у JSON',
      brokenJson.status === 400 && brokenJson.body && typeof brokenJson.body.error === 'string',
      `а прийшло ${brokenJson.status}: ${brokenJson.text.slice(0, 140)}`
    );

    // --- params / query / body (урок з таска 02) ---
    const echo = await t.api('POST', '/debug/echo/15?active=true&tag=shop', { name: 'Anna', age: 30 });
    t.check(
      'POST /debug/echo/15?active=true&tag=shop повертає params, query і body',
      echo.status === 200 &&
        echo.body &&
        echo.body.params &&
        echo.body.params.id === '15' &&
        echo.body.query &&
        echo.body.query.active === 'true' &&
        echo.body.body &&
        echo.body.body.name === 'Anna',
      `а прийшло ${echo.status}: ${echo.text.slice(0, 160)}\n` +
        'params.id має лишитись ТЕКСТОМ "15". У FastAPI легко випадково\n' +
        'отримати число: якщо написати id: int, він сам перетворить.'
    );

    t.info('');
    t.info('Це був швидкий прогін контракту. Повна перевірка — усі таски проти Python:');
    t.info('    node exercises/run.js --all --target=python');
  },

  explain: `
    Що саме ти щойно довела.

    Клієнту байдуже, якою мовою написаний сервер. Він бачить адресу, метод,
    статус, заголовки й тіло — і більше нічого. Усе інше (мова, фреймворк, база,
    кількість серверів) заховано за контрактом. Тому той самий набір перевірок
    зміг прийняти дві різні реалізації, не змінившись ані на рядок.

    Саме тому в справжній роботі контракт описують ОКРЕМО від коду — файлом
    OpenAPI. З нього потім генерують і документацію, і типи для фронтенду, і
    тести. До речі, FastAPI робить цей файл сам: відкрий http://localhost:8000/docs
    у браузері, коли сервер запущено, і побачиш свій API у вигляді сторінки,
    де кожен endpoint можна поклацати.

    Друге, що мало впасти в очі, — різниця у ФІЛОСОФІЇ.

      Express  — мінімалізм: він дає тільки маршрутизацію, а перевірки, статуси
                 й форму відповіді ти пишеш руками. Тому ти й змогла відчути
                 кожен статус-код особисто: без тебе їх ніхто не поставить.
      FastAPI  — батарейки в комплекті: схема описує дані, з неї беруться і
                 валідація, і документація, і типи.

    Обидва підходи живі. Але коли проєкт росте, ручна валідація перестає
    масштабуватись: полів стає сто, і в тридцяти з них хтось забув перевірку.
    Тому в Node теж узяли схеми — бібліотека zod робить приблизно те саме, що
    pydantic. Ти прийшла до цього не з туторіалу, а з власного болю в таску 12 —
    це найкращий спосіб зрозуміти, навіщо потрібен інструмент.

    І третє, дрібне на вигляд, але найважливіше практично: інструмент не диктує
    контракт. FastAPI хотів віддавати 422 і поле "detail" — а ми сказали 400 і
    "error", бо так домовлено з фронтендом. Фреймворк зручний рівно доти, доки
    робить те, що тобі треба; далі ти його акуратно переналаштовуєш. Це і є
    різниця між "користуватись фреймворком" і "працювати НА фреймворк".
  `,
};