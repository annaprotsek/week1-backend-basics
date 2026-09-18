'use strict';

/**
 * Таск 01 — HTTP-методи та статус-коди.
 *
 * Тут нічого не треба програмувати.
 *
 * Ти відкриваєш файл exercises/answers/01-http.answers.js і пишеш, ЩО, НА ТВОЮ
 * ДУМКУ, відповість твій сервер на кожен запит. Потім запускаєш перевірку —
 * і вона показує поруч дві речі: що ти думала і що сталось насправді.
 *
 * Це перевірка не коду, а того, наскільки добре ти пам'ятаєш, як він працює.
 */

const { bodyTypeOf } = require('../lib/harness');
const answers = require('../answers/01-http.answers');

/** Що саме ми запитуємо для кожного рядка з файлу відповідей. */
const CASES = {
  'GET /hello': { method: 'GET', path: '/hello' },
  'GET /users': { method: 'GET', path: '/users' },
  'GET /users/2': { method: 'GET', path: '/users/2' },
  'GET /users/999': { method: 'GET', path: '/users/999' },
  'GET /users/abc': { method: 'GET', path: '/users/abc' },
  'POST /users (name + email)': {
    method: 'POST',
    path: '/users',
    body: { name: 'Test User', email: 'test@example.com' },
  },
  'POST /users (тільки name)': { method: 'POST', path: '/users', body: { name: 'Test User' } },
  'PUT /users/999': { method: 'PUT', path: '/users/999', body: { name: 'Updated' } },
  'DELETE /users/2': { method: 'DELETE', path: '/users/2' },
  'GET /todos?completed=true': { method: 'GET', path: '/todos?completed=true' },
};

module.exports = {
  id: '01',
  type: 'prediction',
  title: 'HTTP-методи та статус-коди',

  brief: `
    Відкрий файл:  exercises/answers/01-http.answers.js

    Там 10 запитів до твого ж сервера. Для кожного напиши, що він, на твою
    думку, відповість:
      status   — число: 200, 201, 400, 404, 204...
      bodyType — що буде в тілі: 'object', 'array' або 'empty'

    Спершу подумай і напиши — і лише потім запускай перевірку.
    У цьому весь сенс: ти побачиш, де твоя картинка коду розходиться
    з тим, як він працює насправді. Помилятись тут можна і навіть корисно.
  `,

  async run(t) {
    const unfilled = Object.entries(answers).filter(
      ([, a]) => a.status === null || a.bodyType === null
    );
    if (unfilled.length === Object.keys(answers).length) {
      t.blocked(
        'Файл exercises/answers/01-http.answers.js ще порожній.\n' +
          '    Відкрий його, замість null напиши свої відповіді — і запусти знову.'
      );
    }
    if (unfilled.length > 0) {
      t.blocked(
        `Ще без відповіді ${unfilled.length} рядків у 01-http.answers.js:\n` +
          unfilled.map(([k]) => `      - ${k}`).join('\n')
      );
    }

    t.info('Зліва — що написала ти. Нижче, якщо не збіглось, — що відповів сервер.\n');

    for (const [name, spec] of Object.entries(CASES)) {
      const expected = answers[name];
      const actual = await t.api(spec.method, spec.path, spec.body);
      const actualType = bodyTypeOf(actual);

      const statusOk = expected.status === actual.status;
      const typeOk = expected.bodyType === actualType;

      t.check(
        `${name}  ->  ти написала ${expected.status} / ${expected.bodyType}`,
        statusOk && typeOk,
        `а сервер відповів: ${actual.status} / ${actualType}` +
          (actual.text ? `\nось його відповідь: ${actual.text.slice(0, 120)}` : '')
      );
    }
  },

  explain: `
    Статус-код — це число, яким сервер одним словом каже, ЩО СТАЛОСЯ. Його видно
    одразу, ще до того, як хтось прочитає саму відповідь:
      200 — все добре, ось твої дані
      201 — я створив нову річ (це відповідь на POST)
      204 — все добре, але показувати нема чого, тому відповідь ПОРОЖНЯ (це DELETE)
      400 — ти надіслала щось не те, виправ запит і спробуй ще
      404 — такого немає

    Окремо про GET /users/abc. Твій код робить Number('abc') — а це "не число"
    (у JavaScript воно так і називається: NaN, not a number). Далі find() шукає
    користувача з таким id, нікого не знаходить — і спрацьовує та сама гілка,
    що й для неіснуючого id. Тому відповідь 404.

    Тобто зараз твій сервер не бачить різниці між "такого користувача немає"
    і "ти взагалі надіслала якусь дурню замість номера". Для першої версії це
    нормально, просто знай про це.
  `,
};
