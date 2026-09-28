'use strict';

/**
 * Таск 09 — зламаний запит не має валити сервер.
 *
 * У таску 08 ти побачила, що буває від зміни одного заголовка. Тепер дивимось,
 * що твій сервер робить із по-справжньому кривими запитами. Зараз — три біди:
 *
 *   1. POST /users з Content-Type: text/plain  ->  500 і сторінка HTML
 *   2. POST /users із поламаним JSON           ->  400, але знову HTML
 *   3. GET /будь-що-неіснуюче                  ->  404, і теж HTML
 *
 * Кожна з них — проблема, і кожна своя.
 *
 * Перша найгірша. 500 означає "я, сервер, зламався" — тобто винен твій код.
 * Але ж винен той, хто надіслав кривий запит! Сталося ось що: Express 5 не
 * розбирає тіло, якщо Content-Type не JSON, і лишає req.body як undefined.
 * А рядок  const { name, email } = req.body  не вміє діставати поля з undefined
 * і кидає помилку. Клієнт написав дурню — а падає сервер.
 *
 * Друга і третя — про формат. Твій API розмовляє JSON'ом, і фронтенд на кожну
 * відповідь робить res.json(). Коли замість JSON прилітає <!DOCTYPE html>, він
 * падає на першому ж символі й не може навіть показати нормальну помилку.
 *
 * ЩО ТРЕБА ЗРОБИТИ (усе в index.js)
 *
 * 1) Одразу ПІСЛЯ app.use(express.json()) — підстрахувати тіло:
 *
 *      app.use((req, res, next) => {
 *        // якщо тіло не розібралось — хай буде порожній об'єкт, а не undefined
 *        ...
 *        next();
 *      });
 *
 *    Тоді POST без тіла дійде до твоєї звичайної перевірки і чесно поверне 400.
 *
 * 2) У САМОМУ КІНЦІ файлу, ПІСЛЯ всіх роутів і ПЕРЕД app.listen:
 *
 *      // сюди потрапляє все, що не підійшло під жоден роут
 *      app.use((req, res) => { ... 404 і { error: '...' } ... });
 *
 *      // а сюди — будь-яка помилка. Саме ЧОТИРИ аргументи роблять цю функцію
 *      // обробником помилок: Express впізнає її за їх кількістю.
 *      app.use((err, req, res, next) => {
 *        // поламаний JSON body-parser позначає так:
 *        //   err.type === 'entity.parse.failed'  (і err.status === 400)
 *        // усе інше — це вже справді наша поломка: 500
 *      });
 *
 * Статус для запиту з чужим Content-Type бери 400 (або 415 Unsupported Media
 * Type, якщо хочеш бути точнішою — перевірка приймає обидва). Головне: не 500
 * і не HTML.
 */

const isJsonError = (res) =>
  res.body !== null &&
  typeof res.body === 'object' &&
  typeof res.body.error === 'string' &&
  String(res.headers['content-type'] || '').includes('application/json');

module.exports = {
  id: '09',
  type: 'code',
  title: 'Зламаний запит: 400 і JSON замість 500 і HTML',

  brief: `
    Редагуєш файл:  index.js

    Зараз твій сервер на криві запити відповідає сторінками HTML, а на
    запит без JSON-тіла взагалі падає з 500 — хоча винен той, хто його
    надіслав, а не ти.

    Три речі, яких треба досягти:
      POST /users з Content-Type: text/plain  -> 400 (або 415) і { error }
      POST /users з поламаним JSON            -> 400 і { error }
      GET /будь-що-неіснуюче                  -> 404 і { error }
    І всі три — з Content-Type: application/json. HTML не віддаємо ніколи.

    Що додати (деталі — угорі файлу exercises/tasks/09-error-shape.js):

      // 1. одразу після app.use(express.json())
      app.use((req, res, next) => { /* req.body не має лишатись undefined */ next(); });

      // 2. у самому кінці, після ВСІХ роутів, перед app.listen
      app.use((req, res) => { /* 404 + { error } */ });
      app.use((err, req, res, next) => { /* саме 4 аргументи! */ });

    Порядок тут — це і є логіка. Постав catch-all вище за роути — він
    з'їсть усе, і сервер перестане працювати взагалі.
  `,

  async run(t) {
    // --- 1. тіло, яке не розібралось ---
    const textPlain = await t.send('POST', '/users', {
      headers: { 'Content-Type': 'text/plain' },
      rawBody: JSON.stringify({ name: 'Anna', email: 'anna@example.com' }),
    });
    t.check(
      'POST /users з Content-Type: text/plain -> 400 або 415 і { error } у JSON',
      (textPlain.status === 400 || textPlain.status === 415) && isJsonError(textPlain),
      `а прийшло ${textPlain.status}, content-type: ${textPlain.headers['content-type']}\n` +
        `відповідь: ${textPlain.text.slice(0, 120)}\n` +
        'Якщо тут 500 — значить, код усе ще намагається дістати поля з req.body,\n' +
        'якого немає. Express 5 не створює req.body, коли тіло не розібралось.'
    );

    const noBody = await t.send('POST', '/users', {});
    t.check(
      'POST /users взагалі без тіла -> 400 або 415 і { error } у JSON',
      (noBody.status === 400 || noBody.status === 415) && isJsonError(noBody),
      `а прийшло ${noBody.status}, відповідь: ${noBody.text.slice(0, 120)}`
    );

    // --- 2. поламаний JSON ---
    const brokenJson = await t.send('POST', '/users', {
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{"name": "Anna", "email":',
    });
    t.check(
      'POST /users з поламаним JSON -> 400 і { error } у JSON',
      brokenJson.status === 400 && isJsonError(brokenJson),
      `а прийшло ${brokenJson.status}, content-type: ${brokenJson.headers['content-type']}\n` +
        `відповідь: ${brokenJson.text.slice(0, 120)}\n` +
        'Тут потрібен обробник помилок — функція з ЧОТИРМА аргументами\n' +
        '(err, req, res, next) у самому кінці файлу.'
    );

    // --- 3. неіснуючі адреси ---
    const unknownGet = await t.api('GET', '/this-route-does-not-exist');
    t.check(
      'GET /this-route-does-not-exist -> 404 і { error } у JSON',
      unknownGet.status === 404 && isJsonError(unknownGet),
      `а прийшло ${unknownGet.status}, content-type: ${unknownGet.headers['content-type']}\n` +
        `відповідь: ${unknownGet.text.slice(0, 120)}`
    );

    const unknownPost = await t.api('POST', '/this-route-does-not-exist', { a: 1 });
    t.check(
      'POST /this-route-does-not-exist -> теж 404 і { error } у JSON',
      unknownPost.status === 404 && isJsonError(unknownPost),
      `а прийшло ${unknownPost.status}, відповідь: ${unknownPost.text.slice(0, 120)}\n` +
        'Catch-all ловить будь-який метод, не тільки GET.'
    );

    const nestedUnknown = await t.api('GET', '/products/1/reviews');
    t.check(
      'GET /products/1/reviews (такої гілки немає) -> 404 і { error } у JSON',
      nestedUnknown.status === 404 && isJsonError(nestedUnknown),
      `а прийшло ${nestedUnknown.status}, відповідь: ${nestedUnknown.text.slice(0, 120)}`
    );

    // --- 4. регресія: все інше живе, як жило ---
    const hello = await t.api('GET', '/hello');
    t.check(
      'GET /hello усе ще працює: 200 і { message }',
      hello.status === 200 && hello.body && hello.body.message === 'Hello, World!',
      `а прийшло ${hello.status}, відповідь: ${hello.text.slice(0, 120)}\n` +
        'Якщо тут 404 — catch-all стоїть ВИЩЕ за роути і перехоплює все.\n' +
        'Він має бути в самому кінці, після всіх app.get / app.post.'
    );

    const created = await t.api('POST', '/users', {
      name: 'Still Works',
      email: 'works@example.com',
    });
    t.check(
      'Нормальний POST /users усе ще створює користувача: 201',
      created.status === 201 && created.body && created.body.name === 'Still Works',
      `а прийшло ${created.status}, відповідь: ${created.text.slice(0, 120)}`
    );

    const list = await t.api('GET', '/users');
    t.check(
      'GET /users усе ще віддає масив',
      list.status === 200 && Array.isArray(list.body),
      `а прийшло ${list.status}, відповідь: ${list.text.slice(0, 120)}`
    );
  },

  explain: `
    Тут три ідеї, і кожну варто забрати окремо.

    1. Middleware — це ЧЕРГА, і порядок у ній і є логікою. Запит іде згори вниз:
       express.json() -> твої роути -> catch-all 404. Кожен або відповідає, або
       каже next() і пропускає далі. Саме тому catch-all мусить стояти останнім:
       він не перевіряє адресу взагалі, він ловить усе, що дожило до нього.

       Обробник помилок — окрема черга. Express впізнає його НЕ за іменем і не за
       місцем, а за КІЛЬКІСТЮ АРГУМЕНТІВ: рівно чотири (err, req, res, next).
       Напишеш три — це буде звичайний middleware, і помилки в нього не потраплять.
       Це той момент, на якому спотикаються всі, бо нічого не падає: просто
       обробник мовчки не працює.

    2. 4xx і 5xx — це різні винуватці, а не просто різні числа.
         4xx — винен клієнт: криве тіло, немає поля, немає такої адреси.
         5xx — винен сервер: це наш баг, і на нього треба заводити задачу.
       Тому 500 через чужий Content-Type — це не дрібниця. Якби на продакшені
       стояв моніторинг (а він стоїть), такий запит підняв би алерт "сервіс
       падає", і хтось прийшов би розбиратись серед ночі. Через нічий баг.

    3. API розмовляє однією мовою — завжди. Фронтенд на кожну відповідь робить
       res.json(). Прилетів <!DOCTYPE html> — і він падає на першому символі,
       навіть не встигнувши показати "щось пішло не так". Одна форма помилки
       { error: "..." } для ВСІХ випадків — це контракт, на який фронт може
       спертись і написати обробку помилок один раз, а не для кожного endpoint'а.

    Дві речі на виріст, поки просто знай:

      - Найточніший статус для "я не вмію читати такий Content-Type" — це
        415 Unsupported Media Type. 400 теж приймають, але 415 каже рівно те,
        що сталось.
      - У справжніх API в тіло помилки кладуть ще й код (щоб фронт міг розрізняти
        випадки програмно) та correlation id — унікальний номер запиту, за яким
        цю саму помилку можна знайти в логах. Виглядає так:
          { "error": { "code": "VALIDATION_ERROR", "message": "...", "correlation_id": "..." } }
  `,
};