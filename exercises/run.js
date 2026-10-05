#!/usr/bin/env node
'use strict';

/**
 * Запуск тасків.
 *
 *   node exercises/run.js          — покроковий режим: веде по одному таску за раз
 *   node exercises/run.js 04       — те саме, але одразу з таска 04
 *   node exercises/run.js --all    — просто прогнати всі перевірки і показати підсумок
 *   node exercises/run.js --all --target=python
 *                                  — ті самі перевірки, але проти python/app.py (таск 16)
 *
 * Перед КОЖНОЮ перевіркою сервер піднімається заново, а після — зупиняється.
 * Тому таски не заважають один одному: те, що ти створила в 06, не зіпсує 04.
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const { startServer, request, connectDb, explainDbError } = require('./lib/harness');
const report = require('./lib/reporter');

/** Спеціальна помилка: таск ще не почато (немає відповідей / немає endpoint'а). */
class Blocked extends Error {}

const TASKS_DIR = path.join(__dirname, 'tasks');

function loadTasks() {
  return fs
    .readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => require(path.join(TASKS_DIR, f)));
}

/**
 * Проганяє один таск: піднімає сервер, виконує перевірки, зупиняє сервер.
 *
 * @param {object} task
 * @param {{quiet?: boolean, target?: string}} [options] quiet — нічого не друкувати
 *        (для початкового огляду); target — яку реалізацію піднімати ('node' | 'python')
 */
async function runTask(task, options = {}) {
  const quiet = options.quiet === true;
  const checks = [];
  // Таск може сам вимагати свою реалізацію (тиждень 3 працює з todo-api).
  let target = task.target || options.target || 'node';
  let server = null;
  let dbClient = null;

  const context = {
    port: null,
    api: (method, urlPath, body) => request(context.port, method, urlPath, body),
    /** Запит із повним контролем: свої заголовки, сире тіло, запит без тіла. */
    send: (method, urlPath, requestOptions) =>
      request(context.port, method, urlPath, undefined, requestOptions),
    check(name, ok, hint) {
      checks.push(Boolean(ok));
      if (!quiet) report.checkLine(name, Boolean(ok), hint);
    },
    info: (text) => {
      if (!quiet) report.infoLine(text);
    },
    blocked(reason) {
      throw new Blocked(reason);
    },
    async restart() {
      await server.stop();
      server = await startServer({ target });
      context.port = server.port;
    },
    /**
     * Прямий канал до бази — повз застосунок.
     * Саме тому перевірка може сказати не лише "API відповів правильно",
     * а й "у таблиці справді з'явився рядок".
     */
    db: {
      async query(sql, params) {
        if (!dbClient) dbClient = await connectDb();
        try {
          return await dbClient.query(sql, params);
        } catch (error) {
          if (error.code === '42P01') {
            throw new Blocked(
              'У базі немає таблиці todos — спочатку зроби таск 19.\n' +
                '    Перевір також, що піднятий саме той контейнер: docker compose ps'
            );
          }
          throw new Error(explainDbError(error));
        }
      },
      /** Чиста таблиця і нумерація з 1 — щоб перевірки були передбачуваними. */
      async reset() {
        await context.db.query('TRUNCATE todos RESTART IDENTITY');
      },
    },

    /** Підняти іншу реалізацію того самого API (потрібно таску 16). */
    async useTarget(nextTarget) {
      if (server) await server.stop();
      target = nextTarget;
      server = await startServer({ target });
      context.port = server.port;
    },
  };

  try {
    if (task.needsServer !== false) {
      server = await startServer({ target });
      context.port = server.port;
    }

    if (!quiet) report.checksHeader();
    await task.run(context);

    const ok = checks.filter(Boolean).length;
    const status = checks.length > 0 && ok === checks.length ? 'passed' : 'failed';

    if (!quiet) {
      if (status === 'passed') {
        report.passed(task);
        if (task.explain) report.explain(task.explain);
      } else {
        report.failed({ ok, total: checks.length });
      }
    }

    return { id: task.id, title: task.title, type: task.type, status };
  } catch (error) {
    // Немає файлу застосунку — таск просто ще не почато, це не поломка.
    if (error instanceof Blocked || error.missingEntry) {
      if (!quiet) report.blocked(error.message);
      return { id: task.id, title: task.title, type: task.type, status: 'blocked' };
    }
    if (!quiet) report.crashed(error);
    return { id: task.id, title: task.title, type: task.type, status: 'failed' };
  } finally {
    if (dbClient) await dbClient.end().catch(() => {});
    if (server) await server.stop();
  }
}

/** Проста обгортка над введенням з клавіатури. */
function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  rl.on('close', () => {
    closed = true;
  });

  return {
    ask(question) {
      // Ввід міг закінчитись (Ctrl+D або запуск не з термінала) — тоді просто виходимо.
      if (closed) return Promise.resolve('q');
      return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim().toLowerCase()));
        rl.once('close', () => resolve('q'));
      });
    },
    close() {
      if (!closed) rl.close();
    },
  };
}

/** Покроковий режим: один таск за раз, з поясненнями і паузами. */
async function guide(tasks, startId, target) {
  report.welcome(tasks.length);
  report.scanning();

  const state = new Map();
  for (const task of tasks) {
    state.set(task.id, await runTask(task, { quiet: true, target }));
  }
  report.progressTable([...state.values()]);

  if ([...state.values()].every((r) => r.status === 'passed')) {
    report.finale([...state.values()]);
    return;
  }

  let index = 0;
  if (startId) {
    const found = tasks.findIndex((t) => t.id === startId);
    index = found === -1 ? 0 : found;
  } else {
    const firstUnfinished = tasks.findIndex((t) => state.get(t.id).status !== 'passed');
    index = firstUnfinished === -1 ? 0 : firstUnfinished;
  }

  const prompt = createPrompt();
  const PROMPT_TEXT = '  [Enter] перевірити   ·   [s] пропустити   ·   [q] вийти  > ';

  try {
    for (; index < tasks.length; index += 1) {
      const task = tasks[index];
      let attempt = 0;

      while (true) {
        if (attempt === 0) report.taskIntro(task, index + 1, tasks.length);
        else report.retryIntro(task);

        const answer = await prompt.ask(PROMPT_TEXT);
        if (answer === 'q') {
          report.finale([...state.values()]);
          return;
        }
        if (answer === 's') break;

        const result = await runTask(task, { target });
        state.set(task.id, result);

        if (result.status === 'passed') {
          report.commitHint(task);
          if (index < tasks.length - 1) await prompt.ask('  [Enter] далі  > ');
          break;
        }
        attempt += 1;
      }
    }

    report.finale([...state.values()]);
  } finally {
    prompt.close();
  }
}

/** Неінтерактивний режим: прогнати все і показати підсумок. */
async function runAll(tasks, target) {
  const results = [];
  for (const task of tasks) {
    report.taskIntro(task, results.length + 1, tasks.length);
    results.push(await runTask(task, { target }));
  }
  report.summary(results);
  return results;
}

async function main() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) {
    console.error(`Потрібен Node 18 або новіший (у тебе ${process.versions.node}).`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const wantAll = args.includes('--all') || args.includes('-a');
  const ids = args.filter((a) => /^\d+$/.test(a)).map((a) => a.padStart(2, '0'));

  const targetArg = args.find((a) => a.startsWith('--target='));
  const target = targetArg ? targetArg.slice('--target='.length) : 'node';
  if (!['node', 'python'].includes(target)) {
    console.error(`Невідомий --target=${target}. Є тільки node і python.`);
    process.exit(1);
  }

  const allTasks = loadTasks();
  const tasks = allTasks;
  const unknown = ids.filter((id) => !tasks.some((t) => t.id === id));
  if (unknown.length > 0) {
    console.error(`Немає таска з номером ${unknown.join(', ')}. Є: ${tasks.map((t) => t.id).join(', ')}`);
    process.exit(1);
  }

  // За замовчуванням показуємо таски поточного тижня: інакше таблиця на 23 рядки
  // і хвилина очікування на старті. --all-weeks повертає всі.
  const weekOf = (t) => t.week || 2;
  const allWeeks = args.includes('--all-weeks');
  const latestWeek = Math.max(...allTasks.map(weekOf));

  let scope;
  if (ids.length > 0) scope = allTasks.filter((t) => ids.includes(t.id));
  else if (allWeeks) scope = allTasks;
  else scope = allTasks.filter((t) => weekOf(t) === latestWeek);

  // Без термінала (наприклад, запуск із скрипта) питати нема кого — просто проганяємо все.
  const interactive = process.stdin.isTTY && !wantAll;

  if (interactive) {
    if (!allWeeks && ids.length === 0) report.weekNote(latestWeek);
    await guide(scope, ids[0], target);
    process.exit(0);
  }

  const selected = scope;
  const results = await runAll(selected, target);
  process.exit(results.every((r) => r.status === 'passed') ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
