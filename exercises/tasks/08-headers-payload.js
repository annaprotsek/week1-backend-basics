'use strict';

/**
 * Таск 08 — заголовки: як сервер розуміє, що йому прислали.
 *
 * Тут нічого не треба програмувати.
 *
 * Ти відкриваєш exercises/answers/08-headers.answers.js і пишеш, що, на твою
 * думку, відповість твій сервер на 7 запитів. Запити відрізняються не адресою
 * і не тілом, а ЗАГОЛОВКАМИ — тими рядками, які летять поруч із тілом.
 *
 * Це продовження таска 01, але на рівень глибше: там ти передбачала статус,
 * тут — ще й те, яким заголовком сервер підпише свою відповідь.
 */

const { bodyTypeOf, contentTypeOf } = require('../lib/harness');
const answers = require('../answers/08-headers.answers');

const USER_BODY = JSON.stringify({ name: 'Test User', email: 'test@example.com' });

/** Що саме ми надсилаємо для кожного рядка з файлу відповідей. */
const CASES = {
  'POST /users · Content-Type: application/json': {
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json' },
    rawBody: USER_BODY,
  },
  'POST /users · Content-Type: application/json; charset=utf-8': {
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    rawBody: USER_BODY,
  },
  'POST /users · тіло []': {
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json' },
    rawBody: '[]',
  },
  'POST /users · тіло порожнє': {
    method: 'POST',
    path: '/users',
    headers: { 'Content-Type': 'application/json' },
    rawBody: '',
  },
  'GET /users · Accept: text/html': {
    method: 'GET',
    path: '/users',
    headers: { Accept: 'text/html' },
  },
  'GET /users/2 · Content-Type: application/json': {
    method: 'GET',
    path: '/users/2',
    headers: { 'Content-Type': 'application/json' },
  },
  'DELETE /users/2': { method: 'DELETE', path: '/users/2' },
};

module.exports = {
  id: '08',
  type: 'prediction',
  title: 'Заголовки: Content-Type і Accept',

  brief: `
    Відкрий файл:  exercises/answers/08-headers.answers.js

    Там 7 запитів до твого ж сервера. Вони майже однакові — відрізняються
    тільки ЗАГОЛОВКАМИ. Для кожного напиши три речі:
      status      — 200, 201, 400, 404, 204...
      bodyType    — 'object' | 'array' | 'empty'
      contentType — чим сервер підпише СВОЮ відповідь: 'json' | 'html' | 'none'

    Дві речі, щоб було від чого відштовхнутись:
      Content-Type у запиті — "ось у якому форматі тіло, яке я НАДСИЛАЮ"
      Accept       у запиті — "ось у якому форматі я хотіла б ОТРИМАТИ відповідь"

    Спершу подумай і напиши — і лише потім запускай перевірку.
  `,

  async run(t) {
    const unfilled = Object.entries(answers).filter(
      ([, a]) => a.status === null || a.bodyType === null || a.contentType === null
    );
    if (unfilled.length === Object.keys(answers).length) {
      t.blocked(
        'Файл exercises/answers/08-headers.answers.js ще порожній.\n' +
          '    Відкрий його, замість null напиши свої відповіді — і запусти знову.'
      );
    }
    if (unfilled.length > 0) {
      t.blocked(
        `Ще без відповіді ${unfilled.length} рядків у 09-headers.answers.js:\n` +
          unfilled.map(([k]) => `      - ${k}`).join('\n')
      );
    }

    t.info('Зліва — що написала ти. Нижче, якщо не збіглось, — що відповів сервер.\n');

    for (const [name, spec] of Object.entries(CASES)) {
      const expected = answers[name];
      const actual = await t.send(spec.method, spec.path, {
        headers: spec.headers,
        rawBody: spec.rawBody,
      });

      const actualBody = bodyTypeOf(actual);
      const actualType = contentTypeOf(actual);

      t.check(
        `${name}\n         ти написала: ${expected.status} / ${expected.bodyType} / ${expected.contentType}`,
        expected.status === actual.status &&
          expected.bodyType === actualBody &&
          expected.contentType === actualType,
        `а сервер відповів: ${actual.status} / ${actualBody} / ${actualType}` +
          (actual.text ? `\nось його відповідь: ${actual.text.slice(0, 120)}` : '')
      );
    }
  },

  explain: `
    Заголовки — це метадані запиту й відповіді: не самі дані, а інструкція, що з
    ними робити. Найважливіші два, і плутати їх не можна:

      Content-Type  — "тіло, яке я НАДСИЛАЮ, у такому форматі"
      Accept        — "відповідь я хотіла б ОТРИМАТИ у такому форматі"

    Чому "; charset=utf-8" нічого не зламав. Порівнюється тільки тип і підтип —
    application/json. Усе після крапки з комою — це параметри, і вони не
    впливають на вибір парсера. Регістр теж не важливий: APPLICATION/JSON
    спрацює так само.

    Чому Accept: text/html нічого не змінив. Твій res.json() завжди віддає JSON,
    що б клієнт не просив. Для JSON-API це нормальна і навіть правильна
    поведінка: API говорить однією мовою. Вміння віддавати різні формати
    залежно від Accept називається content negotiation — воно існує, але
    потрібне рідко.

    Чому [] не прийняли, хоча це валідний JSON. Валідність і правильність — різні
    речі. [] — бездоганний JSON, просто не тієї форми: у масиві немає полів name
    та email. Звідси головне правило: перевіряти треба не "чи це JSON", а
    "чи це ТОЙ САМИЙ об'єкт, якого я чекаю".

    І найцікавіше — DELETE. Статус 204 означає "зроблено, дивитись нема на що".
    У такої відповіді немає не тільки тіла, а й заголовка Content-Type: нема чого
    описувати. Express прибирає його сам, бо цього вимагає стандарт HTTP.

    Наступний таск — про те, що буде, якщо надіслати серверу справді зламаний
    запит. Спойлер: зараз він поводиться погано.
  `,
};