'use strict';

/**
 * Таск 10 — PATCH: часткове оновлення і білий список полів.
 *
 * У HTTP є два різні способи щось змінити, і різниця між ними не в назві:
 *
 *   PUT   — "ось як ця річ має виглядати ЦІЛКОМ". Сервер бере тіло запиту
 *           і робить об'єкт таким. Чого в тілі немає — того не буде й у нього.
 *   PATCH — "зміни ОЦІ поля, решту не чіпай".
 *
 * У твоєму index.js PUT /products/:id насправді поводиться як PATCH: міняє
 * тільки прислані поля. Так вийшло історично, і ми це НЕ переписуємо — на цю
 * поведінку вже спирається таск 06. Це не лінь, а окремий урок, про нього
 * написано в поясненні наприкінці.
 *
 * ЩО ТРЕБА ЗРОБИТИ
 *
 * Додай у index.js новий endpoint:  PATCH /products/:id
 *
 *   немає такого продукту        -> 404 і { error: "..." }
 *   прислали щось невалідне      -> 400 і { error: "..." }, дані при цьому
 *                                   не змінюються взагалі
 *   порожнє тіло {}              -> 200 і продукт як був (це не помилка)
 *   все добре                    -> 200 і оновлений продукт
 *
 * Правила для полів ті самі, що в POST /products:
 *   name  — текст, не порожній
 *   price — ЧИСЛО більше за 0 (текст "10" не приймаємо)
 *   description — текст
 *
 * І головне правило таска: міняти можна ТІЛЬКИ name, price і description.
 * Нічого іншого з тіла запиту в продукт потрапити не має — навіть якщо
 * клієнт це надіслав. Особливо id.
 *
 * Тобто ось так робити НЕ можна:
 *
 *     Object.assign(product, req.body);   // ні!
 *
 * Треба перебирати поля по одному — так, як ти це вже робиш у PUT.
 */

module.exports = {
  id: '10',
  type: 'code',
  title: 'PATCH: часткове оновлення',

  brief: `
    Редагуєш файл:  index.js

    Додай новий endpoint  PATCH /products/:id — часткове оновлення.

      немає такого продукту   -> 404 і { error }
      невалідні дані          -> 400 і { error }, дані НЕ змінюються
      порожнє тіло {}         -> 200 і продукт як був (це не помилка)
      все добре               -> 200 і оновлений продукт

    Правила полів ті самі, що в POST: name — непорожній текст,
    price — число > 0, description — текст.

    Головне правило: міняються ТІЛЬКИ name, price і description.
    Нічого іншого з тіла в продукт потрапити не має — особливо id.
    Тобто Object.assign(product, req.body) тут заборонений.

    PUT не чіпаємо взагалі — він лишається таким, як був. Чому саме так,
    написано в поясненні, коли таск позеленіє.
  `,

  async run(t) {
    const created = await t.api('POST', '/products', {
      name: 'Laptop',
      price: 1200,
      description: 'Робочий ноутбук',
    });
    if (created.status !== 201) {
      t.blocked(
        `Не вдалось створити продукт для перевірки — POST /products відповів ${created.status}.\n` +
          '    Спочатку доведи до зеленого таск 06.'
      );
    }
    const id = created.body.id;

    const probe = await t.api('PATCH', `/products/${id}`, {});
    if (probe.status === 404) {
      t.blocked(
        'Endpoint PATCH /products/:id ще не існує — сервер відповів 404.\n' +
          '    Що саме треба додати, написано зверху файлу\n' +
          '    exercises/tasks/10-patch-partial.js'
      );
    }

    t.check(
      'PATCH з порожнім тілом {} -> 200 і продукт без змін (це не помилка)',
      probe.status === 200 &&
        probe.body &&
        probe.body.name === 'Laptop' &&
        probe.body.price === 1200,
      `а прийшло ${probe.status}, відповідь: ${probe.text.slice(0, 140)}\n` +
        '"Нічого не міняти" — цілком законний запит. Помилки тут немає.'
    );

    const onlyPrice = await t.api('PATCH', `/products/${id}`, { price: 999 });
    t.check(
      'PATCH { price } міняє ціну, а name і description лишає як були',
      onlyPrice.status === 200 &&
        onlyPrice.body &&
        onlyPrice.body.price === 999 &&
        onlyPrice.body.name === 'Laptop' &&
        onlyPrice.body.description === 'Робочий ноутбук',
      `а прийшло ${onlyPrice.status}, відповідь: ${onlyPrice.text.slice(0, 140)}`
    );

    // --- невалідні дані не мають лишати слідів ---
    const badCases = [
      { label: 'price = -1', body: { price: -1 } },
      { label: 'price текстом "500"', body: { price: '500' } },
      { label: 'name порожній', body: { name: '' } },
    ];

    for (const testCase of badCases) {
      const res = await t.api('PATCH', `/products/${id}`, testCase.body);
      t.check(
        `PATCH (${testCase.label}) -> 400 і { error }`,
        res.status === 400 && res.body && typeof res.body.error === 'string',
        `а прийшло ${res.status}, відповідь: ${res.text.slice(0, 140)}`
      );
    }

    const afterBad = await t.api('GET', `/products/${id}`);
    t.check(
      'Після всіх відхилених PATCH продукт цілий: Laptop / 999 / Робочий ноутбук',
      afterBad.status === 200 &&
        afterBad.body.name === 'Laptop' &&
        afterBad.body.price === 999 &&
        afterBad.body.description === 'Робочий ноутбук',
      `а зараз ось що: ${JSON.stringify(afterBad.body)}\n` +
        'Спершу ПЕРЕВІР усе, і тільки потім МІНЯЙ. Інакше виходить смішне:\n' +
        'сервер відповів "400, відмовляю", а половину полів уже переписав.'
    );

    // --- білий список полів ---
    const sneaky = await t.api('PATCH', `/products/${id}`, {
      id: 9999,
      price: 777,
      isAdmin: true,
      createdAt: '2000-01-01',
    });
    t.check(
      'PATCH з чужими полями (id, isAdmin, createdAt) не міняє id продукту',
      sneaky.status !== 500 && (!sneaky.body || sneaky.body.id === id),
      `а id став ${sneaky.body && sneaky.body.id} замість ${id}.\n` +
        'Схоже, десь є Object.assign(product, req.body) або схоже на нього.\n' +
        'Клієнт не має права переписувати поля, які належать серверу.'
    );

    const stillThere = await t.api('GET', `/products/${id}`);
    t.check(
      `Продукт досі лежить за своєю адресою /products/${id}`,
      stillThere.status === 200 && stillThere.body && stillThere.body.id === id,
      `а GET /products/${id} відповів ${stillThere.status}.\n` +
        'Якщо id підмінився — продукт "переїхав" на чужу адресу, і всі\n' +
        'посилання на нього зламались.'
    );

    t.check(
      'Чужі поля (isAdmin, createdAt) не з\'явились у продукті',
      stillThere.body &&
        stillThere.body.isAdmin === undefined &&
        stillThere.body.createdAt === undefined,
      `а продукт зараз такий: ${JSON.stringify(stillThere.body)}`
    );

    const missing = await t.api('PATCH', '/products/9999', { price: 10 });
    t.check(
      'PATCH /products/9999 (такого немає) -> 404',
      missing.status === 404 && missing.body && typeof missing.body.error === 'string',
      `а прийшло ${missing.status}, відповідь: ${missing.text.slice(0, 140)}`
    );

    // --- регресія: PUT лишився таким, як був ---
    const put = await t.api('PUT', `/products/${id}`, { price: 555 });
    t.check(
      'PUT /products/:id поводиться як раніше (таск 06 має лишатись зеленим)',
      put.status === 200 && put.body && put.body.price === 555 && put.body.name === 'Laptop',
      `а прийшло ${put.status}, відповідь: ${put.text.slice(0, 140)}\n` +
        'PUT у цьому таску не чіпаємо. Якщо він зламався — відкоти зміни в ньому.'
    );
  },

  explain: `
    Спочатку про те, чого ми НЕ зробили.

    За стандартом PUT — це повна заміна: "ось як ця річ має виглядати цілком".
    Надіслала PUT з самою ціною — усе інше має обнулитись. Твій PUT так не
    робить, він мерджить. Тобто він неправильний.

    І ми його все одно не виправляємо. Бо на цю поведінку вже хтось спирається:
    таск 06, а в житті — мобільний застосунок, чужа інтеграція, скрипт у когось
    у кроні. Тихо змінити поведінку вже випущеного endpoint'а — це зламати всіх
    клієнтів одночасно, причому мовчки: запити далі повертають 200, просто дані
    тепер псуються. Такі зміни називають breaking changes, і роблять їх або
    через нову версію API (/v2/products), або через новий endpoint — як ми
    щойно і зробили з PATCH.

    Запам'ятай цю пару термінів, вона буде всюди:
      PUT   — ідемпотентний: хоч раз, хоч десять — результат той самий,
              бо ти щоразу описуєш кінцевий стан цілком.
      PATCH — ні. { price: price - 10 } двічі дасть різний результат.
    Через це фронт може спокійно повторити PUT після обриву мережі, а PATCH
    повторювати наосліп не можна.

    Тепер головне з цього таска — білий список полів.

    Спокуса написати Object.assign(product, req.body) — один рядок замість
    десяти. Але тоді в об'єкт потрапить УСЕ, що надіслав клієнт. Сьогодні в
    продукті є тільки name, price і description — і здається, що нічого
    страшного. А завтра там з'явиться ownerId, або isPublished, або discount.
    І будь-хто зможе надіслати { "discount": 99 } і отримати знижку.

    Ця діра має ім'я — mass assignment. Вона регулярно трапляється в реальних
    продуктах, бо виглядає не як діра, а як акуратний короткий код.

    Правило просте: сервер сам вирішує, які поля клієнт має право міняти.
    Перебираєш їх по одному — і все, що не в списку, просто ігноруєш.
    Коли полів стане багато, цим займеться бібліотека валідації (zod у Node,
    pydantic у Python), де білий список — це і є схема. Але думка лишається та сама.
  `,
};