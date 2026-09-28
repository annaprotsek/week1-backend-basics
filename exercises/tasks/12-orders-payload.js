'use strict';

/**
 * Таск 12 — складний payload: замовлення зі списком позицій.
 *
 * Досі всі тіла запитів були пласкі: name, price, completed. Тут уперше
 * приходить структура — об'єкт, усередині якого масив об'єктів. І разом з нею
 * приходить головне питання бекенду: чому даним із тіла запиту не можна вірити.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Додай у index.js новий масив  const orders = []  і два endpoint'и.
 *
 * 1) POST /orders
 *
 *    Приймає:
 *      {
 *        "customer": "Anna",
 *        "items": [
 *          { "productId": 1, "qty": 2 },
 *          { "productId": 3, "qty": 1 }
 *        ]
 *      }
 *
 *    Віддає 201, заголовок Location: /orders/<id> і саме замовлення:
 *      {
 *        "id": 1,
 *        "customer": "Anna",
 *        "items": [
 *          { "productId": 1, "name": "Laptop", "qty": 2, "price": 1200, "subtotal": 2400 }
 *        ],
 *        "total": 2400
 *      }
 *
 *    Зверни увагу, що саме додає СЕРВЕР: name, price, subtotal і total.
 *    Ціну він бере з масиву products, а не з тіла запиту. Навіть якщо клієнт
 *    надіслав свою price — вона ігнорується. Чому — у поясненні наприкінці,
 *    і це найважливіше, що є в цьому таску.
 *
 *    Перевірки (усі -> 400 і { error: "..." }):
 *      customer   — обов'язковий, текст, не порожній
 *      items      — обов'язковий, МАСИВ, не порожній
 *      qty        — ціле число більше за 0 (не "2", не 1.5, не 0)
 *      productId  — продукт із таким id має існувати
 *
 *    І окрема вимога до тексту помилки: якщо проблема в конкретній позиції,
 *    у повідомленні має бути її номер у форматі items[N]. Наприклад:
 *
 *      { "error": "items[1].qty must be an integer greater than 0" }
 *
 *    Чому це важливо: у замовленні може бути 30 позицій. "Bad request" змусить
 *    клієнта шукати помилку вручну, а items[17] — покаже пальцем.
 *    Нумерація з нуля, як у масиві.
 *
 * 2) GET /orders/:id
 *      знайшлось    -> 200 і замовлення
 *      не знайшлось -> 404 і { error: "..." }
 *
 * Порада: винеси перевірку однієї позиції в окрему маленьку функцію і виклич її
 * у циклі. Так код читається, і номер позиції в помилці з'являється природно.
 */

const PRODUCTS = [
  { name: 'Laptop', price: 1200 },
  { name: 'Mouse', price: 25 },
];

module.exports = {
  id: '12',
  type: 'code',
  title: 'Вкладений payload: POST /orders',

  brief: `
    Редагуєш файл:  index.js
    Це найбільший таск блоку. Закладай на нього більше часу.

    Новий масив const orders = [] і два endpoint'и.

      POST /orders   тіло: { customer, items: [ { productId, qty } ] }
                     -> 201, Location: /orders/<id> і замовлення:
                        { id, customer, items: [...], total }
                     де кожна позиція стає
                        { productId, name, qty, price, subtotal }

      GET /orders/:id  -> 200 або 404

    ЦІНУ БЕРЕ СЕРВЕР з масиву products. Якщо клієнт надіслав свою price
    або свій total — вони ігноруються повністю.

    Перевірки (усі -> 400 і { error }):
      customer   — обов'язковий непорожній текст
      items      — обов'язковий непорожній МАСИВ
      qty        — ціле число > 0 (не "2", не 1.5, не 0)
      productId  — такий продукт має існувати

    Помилка в конкретній позиції має називати її номер:
      { "error": "items[1].qty must be an integer greater than 0" }

    Повний опис — угорі файлу exercises/tasks/12-orders-payload.js
  `,

  async run(t) {
    const ids = {};
    for (const product of PRODUCTS) {
      const res = await t.api('POST', '/products', product);
      if (res.status !== 201) {
        t.blocked(
          `Не вдалось створити продукти для перевірки — POST /products відповів ${res.status}.\n` +
            '    Спочатку доведи до зеленого таски 06 і 11.'
        );
      }
      ids[product.name] = res.body.id;
    }
    t.info(`Створили продукти: Laptop 1200 (id ${ids.Laptop}), Mouse 25 (id ${ids.Mouse})\n`);

    const probe = await t.api('POST', '/orders', {
      customer: 'Anna',
      items: [{ productId: ids.Laptop, qty: 2 }],
    });
    if (probe.status === 404) {
      t.blocked(
        'Endpoint POST /orders ще не існує — сервер відповів 404.\n' +
          '    Що саме треба зробити, написано зверху файлу\n' +
          '    exercises/tasks/12-orders-payload.js'
      );
    }

    // --- щасливий шлях ---
    const order = await t.api('POST', '/orders', {
      customer: 'Anna',
      items: [
        { productId: ids.Laptop, qty: 2 },
        { productId: ids.Mouse, qty: 3 },
      ],
    });

    t.check(
      'POST /orders з коректним тілом -> 201',
      order.status === 201,
      `а прийшло ${order.status}, відповідь: ${order.text.slice(0, 160)}`
    );

    const body = order.body || {};
    t.check(
      'У відповіді є id, customer, items і total',
      body.id !== undefined &&
        body.customer === 'Anna' &&
        Array.isArray(body.items) &&
        body.total !== undefined,
      `а прийшло: ${JSON.stringify(body).slice(0, 200)}`
    );

    t.check(
      `Заголовок Location вказує на /orders/${body.id}`,
      typeof order.headers.location === 'string' &&
        new RegExp(`/orders/${body.id}$`).test(order.headers.location),
      `а Location = ${order.headers.location || '(заголовка немає)'}`
    );

    const first = (body.items && body.items[0]) || {};
    t.check(
      'Перша позиція доповнена сервером: name, price і subtotal',
      first.productId === ids.Laptop &&
        first.qty === 2 &&
        first.name === 'Laptop' &&
        first.price === 1200 &&
        first.subtotal === 2400,
      `а прийшло: ${JSON.stringify(first)}\n` +
        'subtotal = price * qty, а price береться з products за productId.'
    );

    t.check(
      'total порахований сервером: 2 * 1200 + 3 * 25 = 2475',
      body.total === 2475,
      `а total = ${JSON.stringify(body.total)}\n` +
        'Це сума всіх subtotal. Рахує сервер, не клієнт.'
    );

    // --- ціна з тіла запиту має ігноруватись ---
    const cheeky = await t.api('POST', '/orders', {
      customer: 'Hacker',
      total: 1,
      items: [{ productId: ids.Laptop, qty: 1, price: 1, subtotal: 1, name: 'Free laptop' }],
    });
    t.check(
      'Ціна й total, надіслані клієнтом, ігноруються: total = 1200, а не 1',
      cheeky.status === 201 && cheeky.body && cheeky.body.total === 1200,
      `а прийшло ${cheeky.status}, total = ${JSON.stringify(cheeky.body && cheeky.body.total)}\n` +
        'Якщо тут 1 — клієнт щойно купив ноутбук за гривню. Ціну бере сервер\n' +
        'з products, а поля price/total/name з тіла запиту не читаються взагалі.'
    );

    // --- читання ---
    const fetched = await t.api('GET', `/orders/${body.id}`);
    t.check(
      `GET /orders/${body.id} -> 200 і те саме замовлення`,
      fetched.status === 200 && fetched.body && fetched.body.total === 2475,
      `а прийшло ${fetched.status}, відповідь: ${fetched.text.slice(0, 160)}`
    );

    const missing = await t.api('GET', '/orders/9999');
    t.check(
      'GET /orders/9999 -> 404 і { error }',
      missing.status === 404 && missing.body && typeof missing.body.error === 'string',
      `а прийшло ${missing.status}, відповідь: ${missing.text.slice(0, 160)}`
    );

    // --- перевірка тіла ---
    const invalid = [
      { label: 'немає customer', body: { items: [{ productId: ids.Mouse, qty: 1 }] } },
      { label: 'customer порожній', body: { customer: '', items: [{ productId: ids.Mouse, qty: 1 }] } },
      { label: 'немає items', body: { customer: 'Anna' } },
      { label: 'items порожній масив', body: { customer: 'Anna', items: [] } },
      { label: 'items не масив', body: { customer: 'Anna', items: 'Mouse' } },
      { label: 'qty = 0', body: { customer: 'Anna', items: [{ productId: ids.Mouse, qty: 0 }] } },
      { label: 'qty = 1.5', body: { customer: 'Anna', items: [{ productId: ids.Mouse, qty: 1.5 }] } },
      { label: 'qty текстом "2"', body: { customer: 'Anna', items: [{ productId: ids.Mouse, qty: '2' }] } },
      { label: 'немає qty', body: { customer: 'Anna', items: [{ productId: ids.Mouse }] } },
      { label: 'productId неіснуючий', body: { customer: 'Anna', items: [{ productId: 9999, qty: 1 }] } },
      { label: 'немає productId', body: { customer: 'Anna', items: [{ qty: 1 }] } },
    ];

    for (const testCase of invalid) {
      const res = await t.api('POST', '/orders', testCase.body);
      t.check(
        `POST /orders (${testCase.label}) -> 400 і { error }`,
        res.status === 400 && res.body && typeof res.body.error === 'string',
        `а прийшло ${res.status}, відповідь: ${res.text.slice(0, 160)}`
      );
    }

    // --- помилка вказує на конкретну позицію ---
    const secondBroken = await t.api('POST', '/orders', {
      customer: 'Anna',
      items: [
        { productId: ids.Laptop, qty: 1 },
        { productId: ids.Mouse, qty: 0 },
      ],
    });
    t.check(
      'Помилка в другій позиції називає її: у тексті є items[1]',
      secondBroken.status === 400 &&
        secondBroken.body &&
        String(secondBroken.body.error).includes('items[1]'),
      `а прийшло: ${secondBroken.text.slice(0, 160)}\n` +
        'Очікується щось на кшталт "items[1].qty must be an integer greater than 0".\n' +
        'Нумерація з нуля: зламана саме друга позиція.'
    );

    // --- відхилені запити не лишають слідів ---
    const productsNow = await t.api('GET', '/products');
    t.check(
      'Жоден запит на замовлення не змінив список продуктів',
      Array.isArray(productsNow.body) && productsNow.body.length === PRODUCTS.length,
      `а продуктів зараз ${productsNow.body && productsNow.body.length} замість ${PRODUCTS.length}.\n` +
        'Замовлення читає products, але нічого в ньому не міняє.'
    );
  },

  explain: `
    Головне речення цього таска: тіло запиту — це не дані, а ЗАЯВКА на дані.
    Його надіслав хтось чужий, і він може надіслати будь-що.

    Подивись ще раз на той запит з "Hacker". Формально він бездоганний: усі поля
    на місці, типи правильні, JSON валідний. Просто клієнт дописав свою ціну.
    Якби сервер її взяв, він продав би ноутбук за гривню — і в логах не було б
    жодної помилки. Тому правило залізне:

      усе, що впливає на гроші, права або доступ, сервер рахує сам.

    Від клієнта приймаємо тільки те, що він має право вирішувати: ЩО він хоче
    (productId) і СКІЛЬКИ (qty). Скільки це коштує — не його рішення.
    Ця сама думка потім повернеться у великому вигляді: клієнту не можна
    вірити ні щодо ціни, ні щодо ролі ("я адмін"), ні щодо того, чий це
    акаунт ("покажи мені замовлення №5").

    Друге — чому ми скопіювали price у позицію замовлення, хоча вона вже є в
    products. Виглядає як дублювання даних, і формально це воно і є. Але ціни
    змінюються. Якщо завтра Laptop подорожчає до 1500, а ми зберігали тільки
    productId — старе замовлення "переоціниться" заднім числом, і чек перестане
    сходитись із тим, що людина реально заплатила. Тому замовлення — це знімок
    моменту: що, за якою ціною і скільки коштувало ТОДІ. Називається це
    денормалізацією, і тут вона не помилка, а вимога.

    Третє — чому неіснуючий productId дає 400, а не 404. 404 говорить про
    АДРЕСУ запиту: "/orders/9999 — такого замовлення немає". А productId лежить
    у ТІЛІ, і адреса /orders цілком існує. Неправильне поле в тілі — це завжди
    400, хоч би що в ньому було. Плутанина тут — одна з найчастіших у людей,
    які тільки починають писати API.

    І четверте, найпрактичніше: помилка має вказувати МІСЦЕ. items[1].qty — це
    відповідь на питання "де саме я помилилась". "Bad request" — не відповідь.
    Коли в замовленні 30 позицій, різниця між цими двома варіантами — це різниця
    між "виправила за секунду" і "півгодини клацала навмання".
    Саме так, до речі, виглядають помилки pydantic і zod: список проблем, і в
    кожній — шлях до поля. Ти щойно написала руками те, що вони роблять зі схеми.
  `,
};