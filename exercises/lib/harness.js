'use strict';

/**
 * Harness — маленький "движок", на якому працюють усі таски.
 *
 * Що він уміє:
 *   1. знайти вільний порт і запустити твій сервер (node index.js) окремим процесом;
 *   2. дочекатися, поки той реально почне відповідати;
 *   3. зробити HTTP-запит і повернути status + заголовки + розібраний JSON;
 *   4. зупинити сервер.
 *
 * Тут навмисно немає жодної зовнішньої бібліотеки — весь файл можна прочитати
 * за 5 хвилин і зрозуміти, що саме відбувається під час перевірки.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_DIR = path.join(PROJECT_ROOT, 'python');
const TODO_DIR = path.join(PROJECT_ROOT, 'todo-api');
const START_TIMEOUT_MS = 10000;

/**
 * Адреса бази. Та сама і для перевірки, і для застосунку, який ми піднімаємо,
 * щоб вони напевно дивились в одне й те саме місце.
 */
const DEFAULT_DATABASE_URL = 'postgres://todo:todo@localhost:5432/todo';
const databaseUrl = () => process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

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
 * Чим саме запускати кожен таргет.
 *
 * Таргет — це реалізація того самого API. 'node' — твій index.js, 'python' —
 * той самий контракт, переписаний на FastAPI (таск 16). Перевірки однакові
 * для обох: у цьому вся ідея — контракт не залежить від мови.
 */
function commandFor(target) {
  if (target === 'python') {
    // Якщо поруч є віртуальне оточення — беремо python з нього, інакше системний.
    const venv = path.join(PYTHON_DIR, '.venv', 'bin', 'python3');
    return {
      file: fs.existsSync(venv) ? venv : process.env.PYTHON || 'python3',
      args: ['app.py'],
      cwd: PYTHON_DIR,
      // Інакше Python буферизує вивід і ми не побачимо помилку, якщо він впаде.
      extraEnv: { PYTHONUNBUFFERED: '1' },
      entry: 'python/app.py',
    };
  }
  if (target === 'todo') {
    // Тиждень 3: окремий FastAPI-застосунок, що працює з PostgreSQL.
    // python/app.py і index.js лишаються недоторканими.
    const ownVenv = path.join(TODO_DIR, '.venv', 'bin', 'python3');
    const sharedVenv = path.join(PYTHON_DIR, '.venv', 'bin', 'python3');
    const interpreter = fs.existsSync(ownVenv)
      ? ownVenv
      : fs.existsSync(sharedVenv)
        ? sharedVenv
        : process.env.PYTHON || 'python3';

    return {
      file: interpreter,
      args: ['app.py'],
      cwd: TODO_DIR,
      extraEnv: { PYTHONUNBUFFERED: '1' },
      entry: 'todo-api/app.py',
    };
  }
  return { file: process.execPath, args: ['index.js'], cwd: PROJECT_ROOT, extraEnv: {}, entry: 'index.js' };
}

/**
 * Запускає сервер окремим процесом і чекає, поки він відповість.
 *
 * Порт передається через змінну оточення PORT. Якщо сервер її ігнорує,
 * ми підстраховуємось і читаємо порт із рядка, який він друкує у консоль
 * ("Server running on http://localhost:3000").
 *
 * @param {{target?: 'node'|'python'}} [options]
 * @returns {Promise<{port:number, target:string, stop:()=>Promise<void>}>}
 */
async function startServer(options = {}) {
  const target = options.target || 'node';
  const command = commandFor(target);

  // Файла застосунку може ще не бути — це не падіння, а "таск ще не почато".
  const entryPath = path.join(PROJECT_ROOT, command.entry);
  if (!fs.existsSync(entryPath)) {
    const hint =
      command.entry === 'todo-api/app.py'
        ? 'Файлу todo-api/app.py ще немає — його створюють у таску 20.\n' +
          '    Як завести оточення і з чого почати — у todo-api/README.md'
        : command.entry === 'python/app.py'
          ? 'Файлу python/app.py ще немає — його створюють у таску 15.\n' +
            '    Деталі — у python/README.md'
          : `Немає файлу ${command.entry}.`;
    throw Object.assign(new Error(hint), { missingEntry: true });
  }

  const assignedPort = await findFreePort();

  const child = spawn(command.file, command.args, {
    cwd: command.cwd,
    env: { ...process.env, ...command.extraEnv, PORT: String(assignedPort), DATABASE_URL: databaseUrl() },
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

  // Сам процес не вдалося запустити (немає python3, немає файлу) — це не падіння
  // сервера, а відсутня програма, і повідомлення має бути іншим.
  let spawnError = null;
  child.on('error', (error) => {
    spawnError = error;
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

      if (spawnError) {
        throw new Error(
          `Не вдалося запустити ${command.file} ${command.args.join(' ')}: ${spawnError.message}\n` +
            (target === 'python'
              ? '  Схоже, немає python3 або немає файлу python/app.py.\n' +
                '  Що робити — написано в python/README.md'
              : target === 'todo'
                ? '  Схоже, немає python3 або немає файлу todo-api/app.py.\n' +
                  '  Що робити — написано в todo-api/README.md'
                : '')
        );
      }

      throw new Error(
        stderr.includes('EADDRINUSE') || wrongPort
          ? `Порт ${printedPort || assignedPort} уже зайнятий іншою програмою.\n` +
            '  Перевірка запускає сервер на вільному порті через змінну оточення PORT,\n' +
            `  тому в ${command.entry} порт має братись саме з неї.`
          : `Сервер впав під час старту:\n${stderr.trim() || stdout.trim() || '(без повідомлення)'}`
      );
    }

    // Порт беремо з того, що надрукував сам сервер, — він тут джерело правди.
    const printed = (stdout.match(/localhost:(\d+)/) || [])[1];
    const port = printed ? Number(printed) : assignedPort;

    try {
      await fetch(`http://localhost:${port}/hello`);
      return { port, target, stop };
    } catch {
      await sleep(30);
    }
  }

  await stop();
  throw new Error(
    `Сервер (${command.entry}) не почав відповідати за ${START_TIMEOUT_MS / 1000} с.\n` +
      `  stdout: ${stdout.trim() || '(порожньо)'}\n` +
      `  stderr: ${stderr.trim() || '(порожньо)'}`
  );
}

/**
 * Один HTTP-запит до сервера.
 *
 * Звичайний виклик — request(port, 'POST', '/users', { name: 'A' }) — сам
 * серіалізує тіло в JSON і ставить Content-Type: application/json.
 *
 * Коли таску треба керувати запитом точніше (свої заголовки, навмисно кривий
 * JSON, запит взагалі без тіла), передається четвертим аргументом undefined,
 * а всі деталі — п'ятим:
 *
 *   request(port, 'POST', '/users', undefined, {
 *     headers: { 'Content-Type': 'text/plain' },
 *     rawBody: 'це не JSON',
 *   })
 *
 * @param {number} port
 * @param {string} method  GET | POST | PUT | PATCH | DELETE
 * @param {string} urlPath наприклад "/users/2?full=true"
 * @param {unknown} [body]  якщо передано — піде як JSON
 * @param {{headers?: Record<string,string>, rawBody?: string}} [options]
 * @returns {Promise<{status:number, body:unknown, text:string, headers:Record<string,string>}>}
 */
async function request(port, method, urlPath, body, options = {}) {
  const hasJsonBody = body !== undefined;
  const hasRawBody = options.rawBody !== undefined;

  const response = await fetch(`http://localhost:${port}${urlPath}`, {
    method,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: hasRawBody ? options.rawBody : hasJsonBody ? JSON.stringify(body) : undefined,
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

  return {
    status: response.status,
    body: parsed,
    text,
    // fetch вже привів імена заголовків до маленьких літер: headers['content-type']
    headers: Object.fromEntries(response.headers),
  };
}

/** Тип тіла відповіді у тих термінах, якими оперують prediction-таски. */
function bodyTypeOf(result) {
  if (result.text.length === 0) return 'empty';
  if (Array.isArray(result.body)) return 'array';
  if (result.body !== null && typeof result.body === 'object') return 'object';
  return 'other';
}

/** Те саме для заголовка Content-Type: 'json' | 'html' | 'none' | 'other'. */
function contentTypeOf(result) {
  const value = result.headers['content-type'];
  if (!value) return 'none';
  if (value.includes('application/json')) return 'json';
  if (value.includes('text/html')) return 'html';
  return 'other';
}

/**
 * Пояснює людською мовою, чому не вдалось підключитись до бази.
 * Для трейні це важливіше за стектрейс драйвера.
 */
function explainDbError(error) {
  const url = databaseUrl();

  if (error.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(error.message)) {
    return (
      `Не можу підключитись до бази (${url}).\n` +
      '  Найімовірніше контейнер не запущений. Підніми його:\n' +
      '    docker compose up -d\n' +
      '  І перевір, що він живий:  docker compose ps'
    );
  }
  if (error.code === '3D000') {
    return (
      `Підключився до Postgres, але бази "todo" там немає (${url}).\n` +
      '  Перевір POSTGRES_DB у docker-compose.yml. Якщо міняла його після\n' +
      '  першого запуску — старий том треба прибрати: docker compose down -v'
    );
  }
  if (error.code === '28P01' || error.code === '28000') {
    return (
      `Postgres відповідає, але не пускає: невірний користувач або пароль (${url}).\n` +
      '  Звір POSTGRES_USER і POSTGRES_PASSWORD у docker-compose.yml.\n' +
      '  Якщо міняла їх після першого запуску: docker compose down -v && docker compose up -d'
    );
  }
  return `Помилка при роботі з базою (${url}):\n  ${error.message}`;
}

/** Окреме з'єднання з базою. Закривати обов'язково — інакше процес не завершиться. */
async function connectDb() {
  // require саме тут: якщо pg ще не встановлено, повідомлення має бути зрозумілим.
  let Client;
  try {
    ({ Client } = require('pg'));
  } catch {
    throw new Error('Не встановлено драйвер pg. Виконай: npm install pg');
  }

  const client = new Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => {});
    throw new Error(explainDbError(error));
  }
  return client;
}

module.exports = {
  startServer,
  request,
  bodyTypeOf,
  contentTypeOf,
  connectDb,
  explainDbError,
  databaseUrl,
  PROJECT_ROOT,
  sleep,
};
