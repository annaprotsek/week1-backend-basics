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
  'GET /hello': { status: 200, bodyType: "object" },

  // Список усіх користувачів
  'GET /users': { status: 200, bodyType: "array" },

  // Конкретний користувач, який існує
  'GET /users/2': { status: 200, bodyType: "object" },

  // Користувач, якого немає
  'GET /users/999': { status: 404, bodyType: "object" },

  // Увага: 'abc' — це не число. Подумай, що зробить твій код у цьому випадку.
  'GET /users/abc': { status: 404, bodyType: "object" },

  // Створення користувача з коректним тілом { name, email }
  'POST /users (name + email)': { status: 201, bodyType: "object" },

  // Створення з тілом { name } — без email
  'POST /users (тільки name)': { status: 400, bodyType: "object" },

  // Оновлення користувача, якого не існує
  'PUT /users/999': { status: 404, bodyType: "object" },

  // Видалення користувача, який існує
  'DELETE /users/2': { status: 204, bodyType: "empty" },

  // Фільтр по query-параметру
  'GET /todos?completed=true': { status: 200, bodyType: "array" },
};
