'use strict';

/**
 * Harness — маленький "движок", на якому працюють усі таски.
 *
 * Що він уміє:
 *   1. знайти вільний порт і запустити твій сервер (node index.js) окремим процесом;
 *   2. дочекатися, поки той реально почне відповідати;
 *   3. зробити HTTP-запит і повернути status + розібраний JSON;
 *   4. зупинити сервер.
 *
 * Тут навмисно немає жодної зовнішньої бібліотеки — весь файл можна прочитати
 * за 5 хвилин і зрозуміти, що саме відбувається під час перевірки.
 */

const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const START_TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Питає в операційної системи будь-який вільний порт.
 * Потрібно, щоб таски не конфліктували з твоїм власним "npm start"
 * і з будь-чим іншим, що вже слухає 3000.
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Запускає index.js окремим процесом і чекає, поки сервер відповість.
 *
 * Порт передається через змінну оточення PORT. Якщо index.js її ігнорує,
 * ми підстраховуємось і читаємо порт із рядка, який сервер друкує у консоль
 * ("Server running on http://localhost:3000").
 *
 * @returns {Promise<{port:number, stop:()=>Promise<void>}>}
 */
async function startServer() {
  const assignedPort = await findFreePort();

  const child = spawn(process.execPath, ['index.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(assignedPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  const stop = async () => {
    if (exited) return;
    child.kill('SIGTERM');
    const deadline = Date.now() + 3000;
    while (!exited && Date.now() < deadline) await sleep(20);
    if (!exited) child.kill('SIGKILL');
  };

  const deadline = Date.now() + START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (exited) {
      const printedPort = (stdout.match(/localhost:(\d+)/) || [])[1];
      const wrongPort = printedPort && Number(printedPort) !== assignedPort;
      await stop();
      throw new Error(
        stderr.includes('EADDRINUSE') || wrongPort
          ? `Порт ${printedPort || assignedPort} уже зайнятий іншою програмою.\n` +
            '  Перевірка запускає сервер на вільному порті через змінну оточення PORT,\n' +
            '  тому в index.js має бути: const PORT = process.env.PORT || 3000;'
          : `Сервер впав під час старту:\n${stderr.trim() || stdout.trim() || '(без повідомлення)'}`
      );
    }

    // Порт беремо з того, що надрукував сам сервер, — він тут джерело правди.
    const printed = (stdout.match(/localhost:(\d+)/) || [])[1];
    const port = printed ? Number(printed) : assignedPort;

    try {
      await fetch(`http://localhost:${port}/hello`);
      return { port, stop };
    } catch {
      await sleep(30);
    }
  }

  await stop();
  throw new Error(
    `Сервер не почав відповідати за ${START_TIMEOUT_MS / 1000} с.\n` +
      `  stdout: ${stdout.trim() || '(порожньо)'}\n` +
      `  stderr: ${stderr.trim() || '(порожньо)'}`
  );
}

/**
 * Один HTTP-запит до сервера.
 *
 * @param {number} port
 * @param {string} method  GET | POST | PUT | DELETE
 * @param {string} urlPath наприклад "/users/2?full=true"
 * @param {unknown} [body] якщо передано — піде як JSON
 * @returns {Promise<{status:number, body:unknown, text:string}>}
 */
async function request(port, method, urlPath, body) {
  const hasBody = body !== undefined;

  const response = await fetch(`http://localhost:${port}${urlPath}`, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null; // відповідь не JSON — таск сам вирішить, чи це проблема
    }
  }

  return { status: response.status, body: parsed, text };
}

/** Тип тіла відповіді у тих термінах, якими оперують prediction-таски. */
function bodyTypeOf(result) {
  if (result.text.length === 0) return 'empty';
  if (Array.isArray(result.body)) return 'array';
  if (result.body !== null && typeof result.body === 'object') return 'object';
  return 'other';
}

module.exports = { startServer, request, bodyTypeOf, PROJECT_ROOT, sleep };
