'use strict';

/**
 * Таск 19 — застосунок нарешті читає з бази.
 *
 * Тут народжується todo-api/app.py. Поки що він уміє рівно одне:
 * віддати список todo, взятий не з масиву в пам'яті, а з PostgreSQL.
 *
 * Доказ, що це справді база, буде прямий: перевірка вставить рядки в таблицю
 * власноруч, повз твій застосунок — і вони мають з'явитись у відповіді.
 */

const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../lib/harness');
const { listOf } = require('../lib/todo-shape');

const REQUIREMENTS = path.join(PROJECT_ROOT, 'todo-api', 'requirements.txt');

module.exports = {
  id: '20',
  week: 3,
  type: 'code',
  title: 'GET /todos з бази',
  target: 'todo',

  brief: `
    Створюєш теку:  todo-api/   (index.js і python/app.py не чіпаєш)

    Три файли:
      todo-api/requirements.txt   fastapi, uvicorn, psycopg[binary]
      todo-api/app.py             сам застосунок
      todo-api/.venv/             оточення (у git не потрапляє)

    Як завести оточення — у todo-api/README.md, він уже лежить на місці.

    Застосунок має вміти рівно одне:

      GET /todos  ->  200 і масив усіх todo, відсортованих за id
                      кожен: { id, title, completed, created_at }

    Адресу бази бери з оточення:  os.environ["DATABASE_URL"]
    Перевірка підставляє її сама, у коді нічого не прописуй.

    Порт — так само з оточення, рівно як у python/app.py з таска 15.

    Головне тут — з'єднання з базою. Відкривати нове на кожен запит дорого,
    тому роблять пул: набір готових з'єднань, які беруть і повертають.

      from psycopg_pool import ConnectionPool
      pool = ConnectionPool(os.environ["DATABASE_URL"], min_size=1, max_size=5)

      with pool.connection() as conn:
          rows = conn.execute("SELECT ... FROM todos ORDER BY id").fetchall()

    Щоб отримувати рядки як словники, а не кортежі:
      from psycopg.rows import dict_row   і далі conn.cursor(row_factory=dict_row)

    Увага: перевірка щоразу чистить таблицю todos і кладе туди свої рядки.
    Це нормально — не тримай у ній нічого, що шкода втратити.
  `,

  async run(t) {
    if (fs.existsSync(REQUIREMENTS)) {
      const requirements = fs.readFileSync(REQUIREMENTS, 'utf8');
      t.check(
        'todo-api/requirements.txt згадує psycopg',
        /psycopg/i.test(requirements),
        'Драйвер треба зафіксувати у requirements.txt — інакше на іншій машині\n' +
          'застосунок не підніметься. Рядок виду:  psycopg[binary]==3.2.3'
      );
    } else {
      t.check(
        'todo-api/requirements.txt існує',
        false,
        'Файлу немає. Залежності фіксуються у requirements.txt — це той самий\n' +
          'принцип, що package.json у Node.'
      );
    }

    // --- порожня таблиця ---
    await t.db.reset();

    const empty = await t.api('GET', '/todos');
    const emptyList = listOf(empty.body);

    t.check(
      'На порожній таблиці GET /todos -> 200 і порожній список',
      empty.status === 200 && Array.isArray(emptyList) && emptyList.length === 0,
      `а прийшло ${empty.status}, тіло: ${empty.text.slice(0, 160)}\n` +
        'Порожньо — це успіх, а не 404. Цей урок уже був у таску 07.'
    );

    // --- рядки, вставлені повз застосунок ---
    await t.db.query(
      `INSERT INTO todos (title, completed) VALUES
         ('Купити хліб', false),
         ('Прочитати про SQL', true),
         ('Подзвонити мамі', false)`
    );

    const filled = await t.api('GET', '/todos');
    const list = listOf(filled.body);

    t.check(
      'Три рядки, вставлені прямо в базу, з\'явились у відповіді',
      filled.status === 200 && Array.isArray(list) && list.length === 3,
      `а прийшло ${filled.status}, у списку ${Array.isArray(list) ? list.length : '?'} елементів: ` +
        `${filled.text.slice(0, 200)}\n` +
        'Якщо тут порожньо — застосунок читає не з тієї бази або не з тієї таблиці.'
    );

    if (Array.isArray(list) && list.length === 3) {
      const [first] = list;

      t.check(
        'У кожного todo є id, title, completed і created_at',
        ['id', 'title', 'completed', 'created_at'].every((field) => field in first),
        `а прийшло ось це: ${JSON.stringify(first)}`
      );

      t.check(
        'Типи правильні: id — число, title — текст, completed — boolean',
        typeof first.id === 'number' &&
          typeof first.title === 'string' &&
          typeof first.completed === 'boolean',
        `id: ${typeof first.id}, title: ${typeof first.title}, ` +
          `completed: ${typeof first.completed}\n` +
          'Якщо completed приходить рядком — глянь, що саме повертає драйвер.'
      );

      t.check(
        'Значення збігаються з тим, що лежить у базі',
        list[0].title === 'Купити хліб' &&
          list[0].completed === false &&
          list[1].completed === true,
        `перший: ${JSON.stringify(list[0])}\nдругий: ${JSON.stringify(list[1])}`
      );

      t.check(
        'Список відсортований за id',
        list.every((todo, i) => i === 0 || list[i - 1].id < todo.id),
        `порядок id: ${list.map((todo) => todo.id).join(', ')}\n` +
          'Без ORDER BY база не зобов\'язана віддавати рядки в якомусь порядку.\n' +
          'Сьогодні пощастить, завтра ні — і це буде дуже дивний баг.'
      );
    }

    // --- зміни в базі одразу видно ---
    await t.db.query("UPDATE todos SET completed = true WHERE title = 'Купити хліб'");
    const afterUpdate = listOf((await t.api('GET', '/todos')).body);

    t.check(
      'Зміна, зроблена прямо в базі, одразу видно через API',
      Array.isArray(afterUpdate) && afterUpdate[0] && afterUpdate[0].completed === true,
      'Схоже, застосунок прочитав дані один раз і запам\'ятав їх у пам\'яті.\n' +
        'Кожен запит має ходити в базу — вона і є джерело правди.'
    );
  },

  explain: `
    Переломний момент усього курсу: дані більше не живуть у застосунку.
    Застосунок став тим, чим він і має бути — тонким шаром, який приймає HTTP,
    ходить у базу й перекладає відповідь у JSON.

    Три речі, які варто винести.

    1. Пул з'єднань. Підключення до бази — дорога операція: мережа, автентифікація,
       виділення ресурсів на сервері. Робити це на кожен HTTP-запит — марнотратство.
       Пул відкриває кілька з'єднань заздалегідь і дає їх у користування: взяла,
       попрацювала, повернула. Саме тому в коді стоїть "with pool.connection()" —
       на виході з блоку з'єднання повертається в пул, а не закривається.

    2. DATABASE_URL з оточення. Той самий принцип, що з PORT у першому тижні:
       усе, що відрізняється між твоїм ноутбуком і сервером, приходить ззовні.
       Адреса бази на проді інша, пароль інший — а код той самий. І, що
       важливіше, пароль не лежить у git.

    3. ORDER BY — не прикраса. Без нього база має повне право віддати рядки в
       будь-якому порядку: вона віддасть так, як їй зручніше прямо зараз.
       Поки рядків мало, вони зазвичай ідуть за вставкою, і здається, що
       сортування не потрібне. Потім таблиця росте, план запиту змінюється —
       і порядок "раптом" ламається. Якщо порядок важливий, він має бути
       написаний явно.

    А ще зверни увагу, чого в коді НЕМАЄ: ніякого масиву todos, ніякого
    nextId, ніякої логіки "знайти індекс і вирізати". Усе це тепер робить база.
    Код став коротшим — і при цьому надійнішим.
  `,
};