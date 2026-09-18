#!/usr/bin/env node
'use strict';

/**
 * Запуск тасків.
 *
 *   node exercises/run.js          — покроковий режим: веде по одному таску за раз
 *   node exercises/run.js 04       — те саме, але одразу з таска 04
 *   node exercises/run.js --all    — просто прогнати всі перевірки і показати підсумок
 *
 * Перед КОЖНОЮ перевіркою сервер піднімається заново, а після — зупиняється.
 * Тому таски не заважають один одному: те, що ти створила в 06, не зіпсує 04.
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const { startServer, request } = require('./lib/harness');
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
 * @param {{quiet?: boolean}} [options] quiet — нічого не друкувати (для початкового огляду)
 */
async function runTask(task, options = {}) {
  const quiet = options.quiet === true;
  const checks = [];
  let server = null;

  const context = {
    port: null,
    api: (method, urlPath, body) => request(context.port, method, urlPath, body),
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
      server = await startServer();
      context.port = server.port;
    },
  };

  try {
    if (task.needsServer !== false) {
      server = await startServer();
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
    if (error instanceof Blocked) {
      if (!quiet) report.blocked(error.message);
      return { id: task.id, title: task.title, type: task.type, status: 'blocked' };
    }
    if (!quiet) report.crashed(error);
    return { id: task.id, title: task.title, type: task.type, status: 'failed' };
  } finally {
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
async function guide(tasks, startId) {
  report.welcome();
  report.scanning();

  const state = new Map();
  for (const task of tasks) {
    state.set(task.id, await runTask(task, { quiet: true }));
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

        const result = await runTask(task);
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
async function runAll(tasks) {
  const results = [];
  for (const task of tasks) {
    report.taskIntro(task, results.length + 1, tasks.length);
    results.push(await runTask(task));
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

  const tasks = loadTasks();
  const unknown = ids.filter((id) => !tasks.some((t) => t.id === id));
  if (unknown.length > 0) {
    console.error(`Немає таска з номером ${unknown.join(', ')}. Є: ${tasks.map((t) => t.id).join(', ')}`);
    process.exit(1);
  }

  // Без термінала (наприклад, запуск із скрипта) питати нема кого — просто проганяємо все.
  const interactive = process.stdin.isTTY && !wantAll;

  if (interactive) {
    await guide(tasks, ids[0]);
    process.exit(0);
  }

  const selected = ids.length > 0 ? tasks.filter((t) => ids.includes(t.id)) : tasks;
  const results = await runAll(selected);
  process.exit(results.every((r) => r.status === 'passed') ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
