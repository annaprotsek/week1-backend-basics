'use strict';

/**
 * GET /todos міняє форму відповіді в таску 22: спочатку це голий масив,
 * потім — конверт { items, total, limit, offset }.
 *
 * Щоб таски 19-21 лишались зеленими після того, як вона зробить 22,
 * перевірки дістають список ось так, а не лізуть у відповідь напряму.
 */
function listOf(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.items)) return body.items;
  return null;
}

module.exports = { listOf };