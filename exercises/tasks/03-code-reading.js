'use strict';

/**
 * Таск 03 — читаємо код, нічого не запускаючи.
 *
 * Питання лежать у файлі exercises/answers/03-code-reading.answers.js.
 *
 * Правильні відповіді тут зашифровані. Не для секретності, а щоб не було
 * спокуси зазирнути: весь сенс таска в тому, щоб спершу подумати головою.
 */

const { createHash } = require('node:crypto');
const answers = require('../answers/03-code-reading.answers');

const hash = (question, answer) =>
  createHash('sha256').update(`${question}:${answer}`).digest('hex').slice(0, 12);

const QUESTIONS = {
  q1: { title: 'PUT з порожнім name — що буде з іменем', expected: 'de5bd8bd9e3b' },
  q2: { title: 'POST /users, якщо прибрати express.json()', expected: '751c8ea895fd' },
  q3: { title: 'GET /users/new, коли /users/:id стоїть вище', expected: '9cc6c1f649ad' },
  q4: { title: 'чому в DELETE стоїть 204 і порожня відповідь', expected: '773017f7778f' },
  q5: { title: 'де опиняється користувач після users.push()', expected: 'f49d1fd4e53b' },
};

module.exports = {
  id: '03',
  type: 'prediction',
  title: 'Читання коду без запуску',

  brief: `
    Відкрий файл:  exercises/answers/03-code-reading.answers.js

    Там 5 питань з варіантами a / b / c про твій ВЛАСНИЙ код.
    Впиши літеру замість null.

    Сервер не запускай і нічого не перевіряй руками — у цьому весь сенс
    таска: прочитати код і подумати, що станеться.
  `,
  needsServer: false,

  async run(t) {
    const unfilled = Object.keys(QUESTIONS).filter((q) => !answers[q]);
    if (unfilled.length === Object.keys(QUESTIONS).length) {
      t.blocked(
        'Файл exercises/answers/03-code-reading.answers.js ще порожній.\n' +
          '    Прочитай питання в ньому і впиши літери замість null.'
      );
    }
    if (unfilled.length > 0) {
      t.blocked(`Ще без відповіді: ${unfilled.join(', ')}`);
    }

    for (const [key, question] of Object.entries(QUESTIONS)) {
      const given = String(answers[key]).trim().toLowerCase();
      t.check(
        `${key} — ${question.title}   (твоя відповідь: ${given})`,
        hash(key, given) === question.expected,
        'Не вгадала. Перечитай саме той шматок index.js, про який питання.\n' +
          'І не запускай сервер, щоб підглянути, — так таск нічого не дасть.'
      );
    }
  },

  explain: `
    q1. Порожній текст "" у JavaScript вважається "неправдою" — так само, як 0,
        null або undefined. Такі значення називають falsy. Тому перевірка
        if (name) для порожнього рядка НЕ спрацьовує, і ім'я лишається старим.
        Виходить неприємна штука: користувач попросив очистити поле, сервер
        відповів 200 "все добре" — а насправді нічого не зробив.
        Як правильно: if (name !== undefined) — тобто "якщо поле взагалі
        надіслали", а не "якщо в ньому щось є".

    q2. express.json() — це middleware, "проміжна" функція, яка бачить запит
        раніше за твій handler. Вона читає тіло запиту і кладе готовий об'єкт
        у req.body. Без неї req.body дорівнює undefined, а рядок
        const { name, email } = req.body  намагається дістати поля з "нічого"
        і ламається. Express перехоплює цю поломку і відповідає 500.
        500 завжди означає одне: "щось зламалось на сервері", тобто винен код,
        а не той, хто надіслав запит.

    q3. Express перебирає маршрути ЗВЕРХУ ВНИЗ і бере ПЕРШИЙ, що підійшов.
        Адреса /users/new чудово підходить під шаблон /users/:id — просто
        id вийде 'new'. Тому до нижчого handler'а черга не дійде взагалі.
        Правило на все життя: конкретні адреси пиши ВИЩЕ за ті, що з :параметром.

    q4. 204 = "зроблено, дивитись нема на що". Тіло відповіді в такому разі
        не читають взагалі, тому щось туди класти немає сенсу.

    q5. Масив users живе всередині запущеної програми node — в оперативній
        пам'яті. Живе рівно стільки, скільки працює ця програма.
        Саме про це таск 08, і саме тому наступна тема — база даних.
  `,
};
