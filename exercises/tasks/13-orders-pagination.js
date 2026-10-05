'use strict';

/**
 * Таск 13 — форма відповіді: конверт і пагінація.
 *
 * Усі твої списки досі віддавали голий масив: [ {...}, {...} ]. Поки записів
 * десять, це чудово працює. А тепер уяви, що замовлень 50 000. Віддати всі
 * одним шматком не можна — ні сервер, ні браузер цього не подякують. Значить,
 * клієнт має просити список ПОРЦІЯМИ:
 *
 *     GET /orders?limit=20&offset=0    перші 20
 *     GET /orders?limit=20&offset=20   наступні 20
 *
 * І одразу виникає питання: а скільки їх усього? Фронту це потрібно, щоб
 * намалювати "сторінка 3 з 47". У голий масив цю цифру покласти нікуди — там
 * лежать замовлення, і тільки вони. Тому список загортають у КОНВЕРТ:
 *
 *     { "items": [ ... ], "total": 50000, "limit": 20, "offset": 40 }
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Додай у index.js endpoint  GET /orders  (цього списку ще немає — у таску 12
 * ти зробила тільки POST /orders і GET /orders/:id).
 *
 *   { items, total, limit, offset }
 *     items  — масив замовлень цієї порції, відсортований за id (менший -> більший)
 *     total  — СКІЛЬКИ ЗАМОВЛЕНЬ УСЬОГО, а не скільки їх у цій порції
 *     limit  — скільки просили (те, що реально застосували)
 *     offset — скільки пропустили
 *
 *   Правила для параметрів:
 *     limit  — не передали: 20. Ціле число від 1 до 100.
 *     offset — не передали: 0. Ціле число від 0.
 *     усе, що порушує ці межі (abc, 0, 101, -1) -> 400 і { error: "..." }
 *
 *   Порожня порція (offset більший за кількість замовлень) — це 200 і
 *   items: [], а не 404. Урок з таска 07: "нічого не знайшлось" — успішна
 *   відповідь.
 *
 * Підказка: порцію з масиву зручно брати через  arr.slice(offset, offset + limit)
 *
 * І ще одне, важливе: /products ми НЕ чіпаємо. Він як віддавав голий масив,
 * так і віддає. Чому — у поясненні наприкінці.
 */

const ids = (envelope) =>
  envelope && Array.isArray(envelope.items) ? envelope.items.map((o) => o.id) : envelope;

module.exports = {
  id: '13',
  type: 'code',
  title: 'Конверт відповіді та пагінація',

  brief: `
    Редагуєш файл:  index.js

    Додай GET /orders — список замовлень у конверті:

      { items: [...], total: 5, limit: 20, offset: 0 }

      items  — порція, відсортована за id
      total  — скільки замовлень УСЬОГО (не скільки в порції)
      limit  — не передали: 20. Ціле від 1 до 100.
      offset — не передали: 0. Ціле від 0.

      ?limit=abc, ?limit=0, ?limit=101, ?offset=-1  -> 400 і { error }
      offset за межами списку -> 200 і items: [] (не 404!)

    Підказка: arr.slice(offset, offset + limit)

    /products не чіпаємо — він і далі віддає голий масив.
  `,

  async run(t) {
    const product = await t.api('POST', '/products', { name: 'Mouse', price: 25 });
    if (product.status !== 201) {
      t.blocked(
        `Не вдалось створити продукт для перевірки — POST /products відповів ${product.status}.\n` +
          '    Спочатку доведи до зеленого таск 06.'
      );
    }

    const created = [];
    for (let i = 1; i <= 5; i += 1) {
      const res = await t.api('POST', '/orders', {
        customer: `Customer ${i}`,
        items: [{ productId: product.body.id, qty: i }],
      });
      if (res.status !== 201) {
        t.blocked(
          `Не вдалось створити замовлення — POST /orders відповів ${res.status}.\n` +
            '    Спочатку доведи до зеленого таск 12.'
        );
      }
      created.push(res.body.id);
    }
    t.info(`Створили 5 замовлень з id = [${created.join(', ')}]\n`);

    const all = await t.api('GET', '/orders');
    if (all.status === 404) {
      t.blocked(
        'Endpoint GET /orders ще не існує — сервер відповів 404.\n' +
          '    Що саме треба зробити, написано зверху файлу\n' +
          '    exercises/tasks/13-orders-pagination.js'
      );
    }

    t.check(
      'GET /orders віддає конверт { items, total, limit, offset }, а не голий масив',
      all.status === 200 &&
        all.body &&
        !Array.isArray(all.body) &&
        Array.isArray(all.body.items) &&
        typeof all.body.total === 'number',
      `а прийшло ${all.status}: ${all.text.slice(0, 160)}`
    );

    t.check(
      'Без параметрів: 5 замовлень, total = 5, limit = 20, offset = 0',
      all.body &&
        all.body.items.length === 5 &&
        all.body.total === 5 &&
        all.body.limit === 20 &&
        all.body.offset === 0,
      `а прийшло: items=${all.body && all.body.items && all.body.items.length}, ` +
        `total=${all.body && all.body.total}, limit=${all.body && all.body.limit}, ` +
        `offset=${all.body && all.body.offset}\n` +
        'limit і offset у відповіді — це ті значення, які сервер РЕАЛЬНО застосував.'
    );

    const firstPage = await t.api('GET', '/orders?limit=2');
    t.check(
      '?limit=2 -> перші два замовлення, але total усе ще 5',
      firstPage.status === 200 &&
        JSON.stringify(ids(firstPage.body)) === JSON.stringify(created.slice(0, 2)) &&
        firstPage.body.total === 5,
      `а прийшло: items=${JSON.stringify(ids(firstPage.body))}, total=${
        firstPage.body && firstPage.body.total
      }\n` +
        'total — це скільки їх УСЬОГО, а не скільки влізло в порцію.\n' +
        'Саме з нього фронт рахує кількість сторінок.'
    );

    const secondPage = await t.api('GET', '/orders?limit=2&offset=2');
    t.check(
      '?limit=2&offset=2 -> третє і четверте замовлення',
      secondPage.status === 200 &&
        JSON.stringify(ids(secondPage.body)) === JSON.stringify(created.slice(2, 4)) &&
        secondPage.body.offset === 2,
      `а прийшло: items=${JSON.stringify(ids(secondPage.body))}, offset=${
        secondPage.body && secondPage.body.offset
      }`
    );

    const lastPage = await t.api('GET', '/orders?limit=2&offset=4');
    t.check(
      '?limit=2&offset=4 -> останнє замовлення (їх лишилось менше, ніж limit)',
      lastPage.status === 200 &&
        JSON.stringify(ids(lastPage.body)) === JSON.stringify(created.slice(4, 5)),
      `а прийшло: items=${JSON.stringify(ids(lastPage.body))}\n` +
        'slice не лається, коли елементів менше, ніж просили, — просто віддає,\n' +
        'скільки є.'
    );

    const beyond = await t.api('GET', '/orders?offset=99');
    t.check(
      '?offset=99 -> 200, items: [] і total: 5 (а не 404)',
      beyond.status === 200 &&
        beyond.body &&
        Array.isArray(beyond.body.items) &&
        beyond.body.items.length === 0 &&
        beyond.body.total === 5,
      `а прийшло ${beyond.status}: ${beyond.text.slice(0, 160)}`
    );

    const badParams = [
      { label: '?limit=abc', path: '/orders?limit=abc' },
      { label: '?limit=0', path: '/orders?limit=0' },
      { label: '?limit=101 (стеля — 100)', path: '/orders?limit=101' },
      { label: '?offset=-1', path: '/orders?offset=-1' },
      { label: '?offset=abc', path: '/orders?offset=abc' },
    ];

    for (const testCase of badParams) {
      const res = await t.api('GET', testCase.path);
      t.check(
        `GET /orders${testCase.label.startsWith('?') ? testCase.label.split(' ')[0] : ''} -> 400 і { error }`,
        res.status === 400 && res.body && typeof res.body.error === 'string',
        `а прийшло ${res.status}: ${res.text.slice(0, 140)}\n` +
          'Нагадування з таска 07: у query завжди ТЕКСТ. Number() і перевірка\n' +
          'на NaN — обов\'язкові, інакше фільтр тихо поверне дурню.'
      );
    }

    const products = await t.api('GET', '/products');
    t.check(
      'GET /products лишився голим масивом (його ми навмисно не чіпали)',
      products.status === 200 && Array.isArray(products.body),
      `а прийшло: ${products.text.slice(0, 140)}\n` +
        'Якщо ти й тут зробила конверт — таски 06 і 07 почервоніють.'
    );
  },

  explain: `
    1. Чому конверт, а не голий масив.

       Голий масив — це глухий кут: у нього неможливо додати нічого, крім
       елементів. Знадобився total — нема куди покласти. Знадобився курсор на
       наступну сторінку, час відповіді, попередження — нема куди. Єдиний вихід
       з глухого кута — змінити форму відповіді, а це ламає всіх клієнтів
       одночасно.

       Конверт цю проблему знімає назавжди: нове поле поруч з items нікому не
       заважає. Тому для списків, які МОЖУТЬ вирости, конверт краще з першого
       дня. Для маленьких і завідомо кінцевих (список статусів, список країн)
       голий масив нормальний.

       Саме тому ми не переписали /products: він уже випущений, на нього
       спираються таски 06 і 07. Це та сама думка, що й з PUT у таску 10 —
       форму відповіді вже випущеного endpoint'а тихо не міняють.

    2. Чому limit має стелю.

       Без неї будь-хто надішле ?limit=10000000, і сервер чесно спробує зібрати
       мільйон записів: база вичитає їх з диска, Node складе гігантський JSON,
       пам'ять закінчиться. Один запит — і сервіс лежить. Це навіть не злий
       намір: досить одного циклу в чужому скрипті.

       Стеля на limit — найдешевший захист від цього класу проблем. Те саме
       стосується розміру тіла запиту, кількості позицій у замовленні, довжини
       тексту. Запам'ятай принцип: усе, що приходить ззовні, має верхню межу.

    3. offset — простий, але не безкоштовний.

       offset=100000 означає "пропусти сто тисяч записів". База все одно
       пройде по них, щоб їх пропустити: що глибша сторінка, то повільніший
       запит. Плюс, якщо поки людина гортає, хтось додасть новий запис, порядок
       зсунеться — і один запис вона побачить двічі, а інший не побачить узагалі.

       Тому у великих API замість offset роблять курсор: "дай наступні 20 ПІСЛЯ
       ось цього id". Працює однаково швидко на будь-якій глибині й не пливе.
       Для нас зараз offset — правильний вибір (простий і зрозумілий), але знай,
       чому від нього згодом відмовляються.
  `,
};