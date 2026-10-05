'use strict';

/**
 * Таск 07 — query-параметри у справжній роботі: фільтрація.
 *
 * У тасках 01 і 02 query була теорією. Тут вона стає кодом.
 *
 * Зверни увагу: НОВОГО endpoint'а не додаємо. Доробляємо той самий
 * GET /products, який уже є. Фільтр — це не інший ресурс, це той самий список,
 * просто показаний під іншим кутом.
 *
 * ЩО ТРЕБА ЗРОБИТИ (усередині GET /products)
 *
 *   ?maxPrice=100     лишити тільки продукти, де price <= 100
 *   ?search=LA        лишити тільки ті, у чиїй назві є шматок "LA",
 *                     причому великі чи малі літери значення не мають:
 *                     "Laptop" і "Lamp" мають знайтись
 *   обидва разом      застосувати обидві умови одночасно
 *   жодного           віддати всі продукти, як і раніше
 *   ?maxPrice=abc     -> 400 і { error: "..." }, бо це не число
 *
 * Дві підказки:
 *   1. Значення з req.query — це завжди ТЕКСТ. Щоб порівняти з ціною,
 *      треба Number(maxPrice). А якщо там була не цифра, вийде NaN —
 *      перевірити це можна через Number.isNaN(...).
 *   2. Щоб не зважати на регістр, зведи обидва боки до малих літер:
 *      name.toLowerCase().includes(search.toLowerCase())
 */

const SEED = [
  { name: 'Laptop', price: 1200 },
  { name: 'Mouse', price: 25 },
  { name: 'Keyboard', price: 50 },
  { name: 'Lamp', price: 90 },
];

const namesOf = (list) => (Array.isArray(list) ? list.map((p) => p.name).sort() : list);

module.exports = {
  id: '07',
  type: 'code',
  title: 'Фільтрація через query-параметри',

  brief: `
    Редагуєш файл:  index.js

    Доробляєш ТОЙ САМИЙ GET /products. Нового endpoint не додаємо!

      ?maxPrice=100      тільки ті, де price <= 100
      ?search=LA         тільки ті, у чиїй назві є "LA"
                         (великі/малі літери не важливі: Laptop і Lamp)
      обидва разом       обидві умови одночасно
      нічого не передали всі продукти
      ?maxPrice=abc      -> 400 і { error: "..." }

    Пам'ятай: те, що приходить у query, — завжди ТЕКСТ.
  `,

  async run(t) {
    for (const item of SEED) {
      const res = await t.api('POST', '/products', item);
      if (res.status !== 201) {
        t.blocked(
          `Не вдалось створити продукти для перевірки — POST /products відповів ${res.status}.\n` +
            '    Спочатку доведи до зеленого таск 06.'
        );
      }
    }

    t.info('Створили 4 продукти: Laptop 1200, Mouse 25, Keyboard 50, Lamp 90\n');

    const all = await t.api('GET', '/products');
    t.check(
      'Без параметрів GET /products віддає всі 4 продукти',
      all.status === 200 && all.body.length === 4,
      `а прийшло ${all.status}, ${JSON.stringify(namesOf(all.body))}`
    );

    const cheap = await t.api('GET', '/products?maxPrice=100');
    t.check(
      '?maxPrice=100 -> Keyboard, Lamp, Mouse',
      cheap.status === 200 &&
        JSON.stringify(namesOf(cheap.body)) === JSON.stringify(['Keyboard', 'Lamp', 'Mouse']),
      `а прийшло ${JSON.stringify(namesOf(cheap.body))}\n` +
        'Якщо тут усі 4 — ти, схоже, порівнюєш ціну з текстом. Текст "1200"\n' +
        'і текст "100" порівнюються не як числа, а по літерах.'
    );

    const search = await t.api('GET', '/products?search=LA');
    t.check(
      '?search=LA -> Lamp, Laptop (великі/малі літери не важливі)',
      search.status === 200 &&
        JSON.stringify(namesOf(search.body)) === JSON.stringify(['Lamp', 'Laptop']),
      `а прийшло ${JSON.stringify(namesOf(search.body))}\n` +
        'Підказка: name.toLowerCase().includes(search.toLowerCase())'
    );

    const both = await t.api('GET', '/products?maxPrice=100&search=LA');
    t.check(
      '?maxPrice=100&search=LA -> тільки Lamp',
      both.status === 200 && JSON.stringify(namesOf(both.body)) === JSON.stringify(['Lamp']),
      `а прийшло ${JSON.stringify(namesOf(both.body))}\n` +
        'Фільтри мають накладатись один на одного: спочатку відсіяли за ціною,\n' +
        'потім із того, що лишилось, — за назвою.'
    );

    const empty = await t.api('GET', '/products?search=zzzz');
    t.check(
      '?search=zzzz -> 200 і ПОРОЖНІЙ масив (а не 404)',
      empty.status === 200 && Array.isArray(empty.body) && empty.body.length === 0,
      `а прийшло ${empty.status}, відповідь: ${empty.text.slice(0, 120)}\n` +
        '"Нічого не знайшлось" — це успішна відповідь. 404 означає зовсім інше:\n' +
        '"такої адреси/такого ресурсу немає".'
    );

    const broken = await t.api('GET', '/products?maxPrice=abc');
    t.check(
      '?maxPrice=abc -> 400',
      broken.status === 400 && broken.body && typeof broken.body.error === 'string',
      `а прийшло ${broken.status}, відповідь: ${broken.text.slice(0, 120)}`
    );
  },

  explain: `
    Три речі, які варто забрати з цього таска.

    1. Порожній результат — це 200 і [], а не 404. 404 говорить про АДРЕСУ:
       "такого ресурсу не існує". А "за твоїм фільтром нічого не підійшло" —
       це цілком успішна відповідь, просто список порожній. Frontend на 200 + []
       намалює "нічого не знайдено", а на 404 — екран помилки. Різниця відчутна.

    2. Query — завжди текст. Тому спочатку Number(), а одразу після цього
       перевірка на NaN. Без неї фільтр з кривим значенням тихо поверне
       порожній список, і ніхто не зрозуміє, чому товари "зникли".

    3. Фільтр не робить нового endpoint'а. /products?maxPrice=100 — це той самий
       список продуктів, просто показаний інакше. Якщо робити окремий
       /cheap-products, то далі знадобиться /expensive-products,
       /cheap-products-sorted... і кінця цьому не буде.
  `,
};
