'use strict';

/**
 * Таск 06 — новий ресурс з нуля: /products.
 *
 * Це найбільший таск. Роби його спокійно і бажано вже БЕЗ підглядання в users:
 * спершу проговори собі вголос, що має статися на кожному кроці, і лише потім пиши.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Додай у index.js новий масив і п'ять endpoint'ів. Масив на старті ПОРОЖНІЙ:
 *
 *     const products = [];
 *
 * Кожен продукт має чотири поля: id, name, price, description.
 *
 * 1) GET /products
 *      віддає масив усіх продуктів, статус 200
 *
 * 2) GET /products/:id
 *      знайшовся   -> 200 і сам продукт
 *      не знайшовся -> 404 і { error: "..." }
 *
 * 3) POST /products
 *      створює продукт, відповідає 201 і створеним продуктом
 *      правила для полів:
 *        name        — обов'язкове, текст, не порожній
 *        price       — обов'язкове, ЧИСЛО більше за 0
 *                      (текст "10" не приймаємо! це 400)
 *        description — не обов'язкове, текст;
 *                      якщо не прислали — записуємо порожній рядок ''
 *      якщо щось із цього порушено -> 400 і { error: "..." }
 *
 * 4) PUT /products/:id
 *      немає такого продукту      -> 404
 *      прислали щось невалідне    -> 400
 *      все добре                  -> 200 і оновлений продукт
 *      ВАЖЛИВО: міняємо тільки ті поля, які прислали. Якщо прийшла сама ціна,
 *      name і description мають лишитись такими, як були.
 *
 * 5) DELETE /products/:id
 *      знайшовся    -> 204 і порожня відповідь
 *      не знайшовся -> 404
 *
 * І ще одне: id не має повторюватись навіть після видалення — це урок з таска 04.
 *
 * Порада: не пиши все одразу. Зроби GET + POST, запусти перевірку, подивись,
 * що позеленіло, потім додай наступне. Так помилку видно одразу.
 */

module.exports = {
  id: '06',
  type: 'code',
  title: 'Новий ресурс: повний CRUD для /products',

  brief: `
    Редагуєш файл:  index.js
    Це найбільший таск. Закладай на нього більше часу.

    Напиши з нуля повний CRUD для продуктів. Масив стартує ПОРОЖНІМ:
      const products = [];

      GET    /products       -> 200 і масив
      GET    /products/:id   -> 200 або 404
      POST   /products       -> 201 або 400
      PUT    /products/:id   -> 200, 400 або 404
      DELETE /products/:id   -> 204 або 404

    Правила для полів:
      name        — обов'язкове, текст, не порожній
      price       — обов'язкове, ЧИСЛО більше за 0 (текст "10" не приймаємо)
      description — не обов'язкове, за замовчуванням порожній рядок ''

    PUT міняє ТІЛЬКИ ті поля, які прислали. Прийшла сама ціна — назва
    й опис лишаються як були.

    Повний опис лежить угорі файлу exercises/tasks/06-products-crud.js

    Порада: не пиши все одразу. Зробила GET і POST — запусти перевірку —
    подивись, що позеленіло — додавай далі.
  `,

  async run(t) {
    const list = await t.api('GET', '/products');
    if (list.status === 404) {
      t.blocked(
        'Endpoint GET /products ще не існує — сервер відповів 404.\n' +
          '    Що саме треба зробити, написано зверху файлу\n' +
          '    exercises/tasks/06-products-crud.js'
      );
    }

    t.check(
      'GET /products віддає 200 і масив',
      list.status === 200 && Array.isArray(list.body),
      `а прийшло ${list.status}, відповідь: ${list.text.slice(0, 120)}`
    );

    // --- створення ---
    const created = await t.api('POST', '/products', {
      name: 'Laptop',
      price: 1200,
      description: 'Робочий ноутбук',
    });
    t.check(
      'POST /products з нормальними даними -> 201',
      created.status === 201,
      `а прийшло ${created.status}, відповідь: ${created.text.slice(0, 160)}`
    );

    const product = created.body || {};
    t.check(
      'У створеного продукту є id, name, price і description',
      product.id !== undefined &&
        product.name === 'Laptop' &&
        product.price === 1200 &&
        product.description === 'Робочий ноутбук',
      `а прийшло ось це: ${JSON.stringify(product)}`
    );

    const noDescription = await t.api('POST', '/products', { name: 'Mouse', price: 25 });
    t.check(
      'POST без description -> 201, а description стає порожнім рядком',
      noDescription.status === 201 && noDescription.body && noDescription.body.description === '',
      `а прийшло ${noDescription.status}, description = ${JSON.stringify(
        noDescription.body && noDescription.body.description
      )}`
    );

    // --- перевірка даних ---
    const invalidCases = [
      { label: 'зовсім немає name', body: { price: 10 } },
      { label: 'name порожній', body: { name: '', price: 10 } },
      { label: 'зовсім немає price', body: { name: 'Bag' } },
      { label: 'price прислали текстом "10"', body: { name: 'Bag', price: '10' } },
      { label: 'price = 0', body: { name: 'Bag', price: 0 } },
      { label: 'price від\'ємний', body: { name: 'Bag', price: -5 } },
    ];

    for (const testCase of invalidCases) {
      const res = await t.api('POST', '/products', testCase.body);
      t.check(
        `POST /products (${testCase.label}) -> 400`,
        res.status === 400 && res.body && typeof res.body.error === 'string',
        `а прийшло ${res.status}, відповідь: ${res.text.slice(0, 120)}`
      );
    }

    // --- читання одного ---
    const one = await t.api('GET', `/products/${product.id}`);
    t.check(
      `GET /products/${product.id} -> 200 і той самий продукт`,
      one.status === 200 && one.body && one.body.id === product.id,
      `а прийшло ${one.status}, відповідь: ${one.text.slice(0, 120)}`
    );

    const missing = await t.api('GET', '/products/9999');
    t.check(
      'GET /products/9999 (такого немає) -> 404',
      missing.status === 404 && missing.body && typeof missing.body.error === 'string',
      `а прийшло ${missing.status}, відповідь: ${missing.text.slice(0, 120)}`
    );

    // --- оновлення ---
    const updated = await t.api('PUT', `/products/${product.id}`, { price: 999 });
    t.check(
      'PUT міняє тільки ціну, а name і description лишає як були',
      updated.status === 200 &&
        updated.body &&
        updated.body.price === 999 &&
        updated.body.name === 'Laptop' &&
        updated.body.description === 'Робочий ноутбук',
      `а прийшло ${updated.status}, відповідь: ${updated.text.slice(0, 160)}\n` +
        'Якщо name або description стали порожні — ти перезаписуєш поля, яких\n' +
        'у запиті не було. Міняй тільки те, що реально прислали.'
    );

    const badUpdate = await t.api('PUT', `/products/${product.id}`, { price: -1 });
    t.check(
      'PUT з поганою ціною -> 400',
      badUpdate.status === 400,
      `а прийшло ${badUpdate.status}, відповідь: ${badUpdate.text.slice(0, 120)}`
    );

    const stillOk = await t.api('GET', `/products/${product.id}`);
    t.check(
      'Після відхиленого PUT ціна лишилась старою (999)',
      stillOk.body && stillOk.body.price === 999,
      `а зараз price = ${JSON.stringify(stillOk.body && stillOk.body.price)}`
    );

    const updateMissing = await t.api('PUT', '/products/9999', { price: 10 });
    t.check(
      'PUT /products/9999 (такого немає) -> 404',
      updateMissing.status === 404,
      `а прийшло ${updateMissing.status}`
    );

    // --- видалення ---
    const removed = await t.api('DELETE', `/products/${product.id}`);
    t.check(
      'DELETE існуючого продукту -> 204 і порожня відповідь',
      removed.status === 204 && removed.text.length === 0,
      `а прийшло ${removed.status}, у відповіді: "${removed.text.slice(0, 80)}"`
    );

    const afterDelete = await t.api('GET', `/products/${product.id}`);
    t.check(
      'Після видалення той самий GET -> 404',
      afterDelete.status === 404,
      `а прийшло ${afterDelete.status}`
    );

    const deleteAgain = await t.api('DELETE', `/products/${product.id}`);
    t.check(
      'Видалити те саме вдруге -> 404',
      deleteAgain.status === 404,
      `а прийшло ${deleteAgain.status}`
    );

    // --- id не повторюються ---
    const fresh = await t.api('POST', '/products', { name: 'Keyboard', price: 50 });
    const allIds = (await t.api('GET', '/products')).body.map((p) => p.id);
    t.check(
      `Усі id продуктів різні: [${allIds.join(', ')}] (новому дали ${fresh.body && fresh.body.id})`,
      new Set(allIds).size === allIds.length,
      'Схоже, знову products.length + 1. Подивись таск 04.'
    );
  },

  explain: `
    Ти щойно написала другий ресурс за тією ж схемою, що й перший — і це головне,
    що варто забрати. CRUD — це один шаблон, а не 20 різних задач. Для будь-чого:
    для користувачів, продуктів, замовлень, статей — однаково:

      POST   -> створити   -> 201 і створений об'єкт
      GET    -> прочитати  -> 200 і об'єкт або масив
      PUT    -> змінити    -> 200 і оновлений об'єкт
      DELETE -> видалити   -> 204 і порожньо
      немає такого id      -> 404
      прислали дурню       -> 400

    Дві речі відрізняють акуратний API від "аби працювало":

      1) перевіряємо ДО того, як міняємо. Відхилений запит не має лишати слідів;
      2) у PUT міняємо тільки ті поля, що прислали. Інакше запит "зміни ціну"
         тихо затре назву й опис — це називається "часткове оновлення",
         і саме на ньому найчастіше горять.

    Коли відчула це на другому ресурсі — третій рука пише вже сама.
  `,
};
