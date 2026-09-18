'use strict';

/**
 * ТАСК 01 — твої ВІДПОВІДІ.
 *
 * Правила:
 *   1. Спочатку думаєш і заповнюєш — ПОТІМ запускаєш перевірку.
 *      Сенс таска не в тому, щоб вгадати, а в тому, щоб побачити,
 *      де твоє уявлення про власний код розходиться з реальністю.
 *   2. Не запускай сервер і не перевіряй руками, поки не заповниш усе.
 *   3. Помилитись тут — нормально і корисно. Не соромно.
 *
 * Що вписувати:
 *   status   — число, HTTP статус-код, який поверне ТВІЙ сервер (200, 201, 400, 404, 204...)
 *   bodyType — що буде в тілі відповіді, одне з трьох рядків:
 *                'object' — JSON-об'єкт, напр. { "id": 1, ... }
 *                'array'  — JSON-масив,  напр. [ {...}, {...} ]
 *                'empty'  — тіла немає взагалі
 *
 * Запуск після заповнення:  node exercises/run.js 01
 */

module.exports = {
  // Найпростіший endpoint
  'GET /hello': { status: null, bodyType: null },

  // Список усіх користувачів
  'GET /users': { status: null, bodyType: null },

  // Конкретний користувач, який існує
  'GET /users/2': { status: null, bodyType: null },

  // Користувач, якого немає
  'GET /users/999': { status: null, bodyType: null },

  // Увага: 'abc' — це не число. Подумай, що зробить твій код у цьому випадку.
  'GET /users/abc': { status: null, bodyType: null },

  // Створення користувача з коректним тілом { name, email }
  'POST /users (name + email)': { status: null, bodyType: null },

  // Створення з тілом { name } — без email
  'POST /users (тільки name)': { status: null, bodyType: null },

  // Оновлення користувача, якого не існує
  'PUT /users/999': { status: null, bodyType: null },

  // Видалення користувача, який існує
  'DELETE /users/2': { status: null, bodyType: null },

  // Фільтр по query-параметру
  'GET /todos?completed=true': { status: null, bodyType: null },
};
