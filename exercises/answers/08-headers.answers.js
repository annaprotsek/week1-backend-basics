'use strict';

/**
 * ТАСК 08 — твої ВІДПОВІДІ.
 *
 * Правила ті самі, що в таску 01:
 *   1. Спочатку думаєш і заповнюєш — ПОТІМ запускаєш перевірку.
 *   2. Сервер руками не чіпаєш, поки не заповнила все.
 *   3. Помилитись тут нормально. Саме заради помилок таск і існує.
 *
 * Тут з'являється третя колонка — заголовок відповіді Content-Type.
 * Заголовки — це ті рядки, які летять поруч із тілом запиту і відповіді.
 * Вони не видно в браузері, але саме вони кажуть, ЯК читати те, що приїхало.
 *
 * Що вписувати:
 *   status      — число: 200, 201, 400, 404, 204, 500...
 *   bodyType    — 'object' | 'array' | 'empty'  (як у таску 01)
 *   contentType — яким заголовком Content-Type сервер підпише СВОЮ відповідь:
 *                   'json' — application/json
 *                   'html' — text/html
 *                   'none' — заголовка немає взагалі
 *
 * Дві речі, які варто розуміти ще до заповнення:
 *
 *   Content-Type у ЗАПИТІ  — "ось у якому форматі тіло, яке я тобі надсилаю"
 *   Accept у ЗАПИТІ        — "а ось у якому форматі я хотіла б відповідь"
 *
 * Запуск після заповнення:  node exercises/run.js 08
 */

module.exports = {
  // Звичайний, правильний запит. Точка відліку.
  'POST /users · Content-Type: application/json': { status: null, bodyType: null, contentType: null },

  // Той самий запит, але в заголовку дописаний "; charset=utf-8".
  // Питання: сервер сприйме це як JSON чи скаже, що формат не той?
  'POST /users · Content-Type: application/json; charset=utf-8': {
    status: null,
    bodyType: null,
    contentType: null,
  },

  // Тіло — порожній масив [].  Це ВАЛІДНИЙ JSON.
  // Питання: чи достатньо бути валідним JSON, щоб запит прийняли?
  'POST /users · тіло []': { status: null, bodyType: null, contentType: null },

  // Content-Type правильний, а тіла немає взагалі (порожній рядок).
  'POST /users · тіло порожнє': { status: null, bodyType: null, contentType: null },

  // Клієнт просить HTML: Accept: text/html.
  // Питання: сервер піде йому назустріч чи віддасть своє?
  'GET /users · Accept: text/html': { status: null, bodyType: null, contentType: null },

  // Content-Type: application/json у GET-запиті, у якого тіла взагалі немає.
  'GET /users/2 · Content-Type: application/json': { status: null, bodyType: null, contentType: null },

  // Видалення. Згадай, чим 204 відрізняється від 200.
  'DELETE /users/2': { status: null, bodyType: null, contentType: null },
};