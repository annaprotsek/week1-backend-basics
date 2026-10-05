'use strict';

/**
 * Таск 16 — КОНТРОЛЬНА.
 *
 * Підсумок усього курсу: 12 питань по тасках 01-15.
 *
 * Програмувати тут нічого не треба. Ти відкриваєш
 * exercises/answers/16-final.answers.js, заповнюєш усі 12 відповідей —
 * і лише потім запускаєш перевірку.
 *
 * Частина 1 (8 питань) перевіряється на твоєму ж сервері: перевірка реально
 * надсилає ці запити і порівнює відповідь із тим, що ти написала.
 * Частина 2 (4 питання) — концепції; правильні відповіді захешовані, щоб
 * не було спокуси підглянути.
 */

const { createHash } = require('node:crypto');
const { bodyTypeOf } = require('../lib/harness');
const answers = require('../answers/16-final.answers');

const hash = (question, answer) =>
  createHash('sha256').update(`${question}:${answer}`).digest('hex').slice(0, 12);

/** Частина 1: що саме надсилаємо для кожного питання. */
const REQUESTS = {
  q1: {
    label: 'GET /users/abc',
    run: (t) => t.api('GET', '/users/abc'),
  },
  q2: {
    label: 'PUT /todos/1 з { "completed": "false" }',
    run: (t) => t.api('PUT', '/todos/1', { completed: 'false' }),
  },
  q3: {
    label: 'POST /users з тілом []',
    run: (t) =>
      t.send('POST', '/users', {
        headers: { 'Content-Type': 'application/json' },
        rawBody: '[]',
      }),
  },
  q4: {
    label: 'POST /users зі зламаним JSON {"name":"A"',
    run: (t) =>
      t.send('POST', '/users', {
        headers: { 'Content-Type': 'application/json' },
        rawBody: '{"name":"A"',
      }),
  },
  q5: {
    label: 'POST /products з назвою, яка вже існує',
    run: (t) => t.api('POST', '/products', { name: 'Laptop', price: 999 }),
  },
  q6: {
    label: 'PATCH /products/1 з { "price": "50" }',
    run: (t) => t.api('PATCH', '/products/1', { price: '50' }),
  },
  q7: {
    label: 'GET /products?search=zzzz',
    run: (t) => t.api('GET', '/products?search=zzzz'),
  },
  q8: {
    label: 'GET /orders?offset=99',
    run: (t) => t.api('GET', '/orders?offset=99'),
  },
};

/** Частина 2: тільки хеші правильних літер. */
const CONCEPTS = {
  q9: { label: 'чому users.length + 1 — погана ідея для id', expected: '27b837c5c50b' },
  q10: { label: 'хто має рахувати суму замовлення', expected: '3f7be01351ff' },
  q11: { label: 'два однакові сервери одночасно — що з даними', expected: 'eb7aa1aba71f' },
  q12: { label: 'чому в FastAPI-версії ми віддаємо 400 і error, а не 422 і detail', expected: '96bea36a4623' },
};

/**
 * Готує стан, на якому ставляться питання:
 * продукт "Laptop" (для q5 і q6) та одне замовлення (для q8).
 */
async function seed(t) {
  const product = await t.api('POST', '/products', {
    name: 'Laptop',
    price: 1200,
    description: 'Робочий ноутбук',
  });

  if (product.status !== 201 || !product.body || product.body.id !== 1) {
    t.blocked(
      'Не вдалося підготувати дані для контрольної: POST /products повернув ' +
        `${product.status} (очікували 201 і продукт з id 1).\n` +
        '    Схоже, щось поламалось у попередніх тасках — прожени спочатку їх.'
    );
  }

  await t.api('POST', '/orders', {
    customer: 'Anna',
    items: [{ productId: product.body.id, qty: 2 }],
  });
}

module.exports = {
  id: '16',
  type: 'exam',
  title: 'КОНТРОЛЬНА: усе разом',

  brief: `
    Відкрий файл:  exercises/answers/16-final.answers.js

    12 питань по всьому курсу, тасках 01-15. Писати код не треба.

      Частина 1 (q1-q8)   — що відповість твій сервер на конкретний запит.
                            Для кожного: status і bodyType.
      Частина 2 (q9-q12)  — чому саме так. Варіанти a / b / c.

    Правила тут суворіші, ніж у звичайних тасках:
      - заповнюєш ВСІ 12 і лише потім запускаєш;
      - сервер не піднімаєш, запити руками не пробуєш, у код не підглядаєш;
      - не знаєш — пиши найімовірніше і йди далі.

    Це не екзамен на оцінку. Це спосіб побачити, що вже лежить у голові,
    а що варто повторити перед наступною темою.
  `,

  async run(t) {
    const liveKeys = Object.keys(REQUESTS);
    const conceptKeys = Object.keys(CONCEPTS);

    const unfilled = [
      ...liveKeys.filter((k) => !answers[k] || answers[k].status === null || answers[k].bodyType === null),
      ...conceptKeys.filter((k) => !answers[k]),
    ];

    if (unfilled.length === liveKeys.length + conceptKeys.length) {
      t.blocked(
        'Файл exercises/answers/16-final.answers.js ще порожній.\n' +
          '    Відкрий його, заповни всі 12 відповідей — і запусти знову.'
      );
    }
    if (unfilled.length > 0) {
      t.blocked(
        `Контрольна приймається тільки цілком. Без відповіді: ${unfilled.join(', ')}\n` +
          '    Заповни решту — і запускай.'
      );
    }

    await seed(t);

    let correct = 0;

    t.info('ЧАСТИНА 1 — що відповість твій сервер\n');

    for (const key of liveKeys) {
      const expected = answers[key];
      const actual = await REQUESTS[key].run(t);
      const actualType = bodyTypeOf(actual);
      const ok = expected.status === actual.status && expected.bodyType === actualType;
      if (ok) correct += 1;

      t.check(
        `${key}. ${REQUESTS[key].label}\n         ти написала: ${expected.status} / ${expected.bodyType}`,
        ok,
        `а сервер відповів: ${actual.status} / ${actualType}` +
          (actual.text ? `\nось його відповідь: ${actual.text.slice(0, 120)}` : '')
      );
    }

    t.info('\nЧАСТИНА 2 — чому саме так\n');

    for (const key of conceptKeys) {
      const given = String(answers[key]).trim().toLowerCase();
      const ok = hash(key, given) === CONCEPTS[key].expected;
      if (ok) correct += 1;

      t.check(
        `${key}. ${CONCEPTS[key].label}   (твоя відповідь: ${given})`,
        ok,
        'Не те. Перечитай питання і згадай таск, з якого воно взялось —\n' +
          'номер підкаже пояснення внизу, коли контрольна зійдеться.'
      );
    }

    const total = liveKeys.length + conceptKeys.length;
    t.info(`\nРезультат: ${correct} з ${total}`);
    if (correct < total) {
      t.info('Виправ те, що не зійшлося, і запусти ще раз: node exercises/run.js 16');
    }
  },

  explain: `
    Коротко по кожному питанню — і головне, до чого воно було.

    q1. GET /users/abc -> 404. Усе, що приходить в адресі, — ТЕКСТ. Number('abc')
        дає NaN, find() нікого не знаходить, спрацьовує звичайна гілка "немає
        такого". Строго кажучи, тут доречніше 400 ("це навіть не схоже на id"),
        але твій код цієї різниці не робить — і це нормально знати про себе.

    q2. PUT /todos/1 з "false" -> 400. Текст "false" — не значення false.
        Перевіряй ТИП на вході, а не покладайся на Boolean(): Boolean("false")
        дасть true, і баг поїде далі мовчки.

    q3. POST /users з [] -> 400. Валідний JSON і правильний JSON — різні речі.
        Питання не "чи це JSON", а "чи це той об'єкт, якого я чекаю".

    q4. POST /users зі зламаним JSON -> 400, і обов'язково JSON у відповіді.
        Клієнт винен -> 4xx. Віддати тут 500 і HTML — означає збрехати клієнту
        про те, хто помилився, та ще й зламати йому розбір відповіді.

    q5. Другий "Laptop" -> 409 Conflict. Це не 400: з запитом усе гаразд,
        конфліктує він зі станом сервера. І не 200: нічого не створили.

    q6. PATCH з "50" -> 400. PATCH міняє частину полів, але перевіряє їх так
        само суворо, як POST. Послаблення правил "бо це ж лише оновлення" —
        класична дірка.

    q7. search=zzzz -> 200 і []. Порожній результат — успіх. 404 говорить про
        АДРЕСУ ("такого ресурсу немає"), а не про кількість знайденого.

    q8. offset=99 -> 200 і ОБ'ЄКТ, не масив. GET /orders віддає конверт
        { items, total, limit, offset }. Саме тому конверт і потрібен: items
        порожній, а total усе одно каже, скільки всього є. З голого масиву
        клієнт цього не дізнався б ніколи.

    q9. (b) Довжина масиву і найбільший виданий id — різні числа, і після
        першого ж DELETE вони розходяться. Баг тихий: нічого не падає, просто
        одного дня API віддає не того. Тому id веде окремий лічильник, а в
        справжньому проєкті — база.

    q10. (c) Усе, що прийшло від клієнта, — недовірені дані. Ціну й суму сервер
         бере зі СВОЇХ продуктів. Інакше будь-хто купить ноутбук за 1 гривню,
         просто відредагувавши тіло запиту.

    q11. (a) Масив живе в пам'яті конкретного процесу. Два процеси — два різні
         масиви. Тому такий застосунок не можна ні перезапустити без втрат, ні
         "розмножити" під навантаження. Рішення — винести стан назовні, у базу.

    q12. (a) Контракт API — це домовленість із тими, хто його споживає, і вона
         не має залежати від того, якою мовою написаний сервер сьогодні.
         Фреймворк зручний рівно доти, доки робить те, що тобі треба; далі ти
         його переналаштовуєш. Це і є різниця між "користуватись фреймворком"
         і "працювати на фреймворк".

    Якщо все зійшлося — матеріал закріплений, можна братись за PostgreSQL.
    Якщо щось ні — це просто список тем на повторення, не більше.
  `,
};