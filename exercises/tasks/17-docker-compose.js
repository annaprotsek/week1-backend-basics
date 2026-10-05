'use strict';

/**
 * Таск 17 — Docker: спочатку контейнер руками, потім Compose.
 *
 * Перший таск третього тижня. Коду немає — є інфраструктура.
 *
 * Навмисно у два кроки. Спершу вона піднімає Postgres довгою командою
 * docker run і відчуває, що таке контейнер. Потім бачить, у чому з цим
 * проблема, — і переписує те саме у файл. Compose після цього виглядає
 * не магією, а очевидним рішенням.
 */

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../lib/harness');

const COMPOSE_PATH = path.join(PROJECT_ROOT, 'docker-compose.yml');
const DATA_DIR = '/var/lib/postgresql/data';

/** Запускає docker-команду і повертає її вивід. Помилку не кидає — віддає ok: false. */
function docker(args) {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout: 15000 }, (error, stdout, stderr) => {
      resolve({ ok: !error, out: `${stdout}${stderr}`.trim() });
    });
  });
}

module.exports = {
  id: '17',
  week: 3,
  type: 'code',
  title: 'Docker: контейнер руками і через Compose',
  needsServer: false,

  brief: `
    Коду в цьому таску немає. Є база даних, яку треба підняти.

    ── КРОК 1. Підняти Postgres руками (це не перевіряється, але зроби) ──

    Спочатку забери образ — готовий "злiпок" програми з усім, що їй треба:

      docker pull postgres:16
      docker images                       # подивись, що з'явилось

    Тепер запусти з нього контейнер:

      docker run --name pg-probe \\
        -e POSTGRES_PASSWORD=secret \\
        -p 5432:5432 \\
        -d postgres:16

      -e   змінна оточення всередині контейнера
      -p   5432 на твоїй машині -> 5432 всередині контейнера
      -d   у фоні (detached), інакше термінал залишиться зайнятим

    Подивись, що вийшло, і зазирни всередину:

      docker ps                           # хто зараз працює
      docker logs pg-probe                # що він пише
      docker exec -it pg-probe psql -U postgres    # зайти в psql (\\q — вийти)

    А тепер головне. Створи щось у цій базі (CREATE TABLE probe(id int);),
    вийди, і прибери контейнер:

      docker stop pg-probe
      docker rm pg-probe

    Запусти ту саму команду docker run ще раз і подивись, чи є твоя таблиця.
    Її немає. Разом з контейнером зникло все, що було всередині.

    ── КРОК 2. Те саме, але файлом ──

    Команда вище довга, у ній легко помилитись, і наступного тижня ти її не
    згадаєш. Тому її записують у файл.

    Створи  docker-compose.yml  у корені репозиторію. Один сервіс:

      образ        postgres:16
      порт         5432 -> 5432
      POSTGRES_USER      todo
      POSTGRES_PASSWORD  todo
      POSTGRES_DB        todo
      том          іменований том, змонтований у ${DATA_DIR}

    Том — це те, чого не вистачало в кроці 1: окреме сховище, яке живе своїм
    життям і переживає видалення контейнера.

      docker compose up -d        # підняти
      docker compose ps           # перевірити
      docker compose logs db      # якщо щось не так
      docker compose down         # прибрати (том лишається!)

    Якщо Docker ще не стоїть: https://docs.docker.com/get-docker/
  `,

  async run(t) {
    // --- чи є взагалі Docker ---
    const info = await docker(['info', '--format', '{{.ServerVersion}}']);
    if (!info.ok) {
      t.blocked(
        'Docker не відповідає.\n' +
          '    Якщо він не встановлений: https://docs.docker.com/get-docker/\n' +
          '    Якщо встановлений — запусти Docker Desktop і дочекайся, поки він стартує.\n' +
          `    Деталі: ${info.out.split('\n')[0]}`
      );
    }
    t.info(`Docker працює, версія движка ${info.out}\n`);

    const images = await docker(['images', '--format', '{{.Repository}}:{{.Tag}}']);
    t.check(
      'Образ postgres завантажений на твою машину',
      /postgres/.test(images.out),
      'Не бачу образу postgres серед локальних.\n' +
        'Образ — це шаблон, з якого створюються контейнери. Забери його:\n' +
        '  docker pull postgres:16'
    );

    // --- compose-файл ---
    if (!fs.existsSync(COMPOSE_PATH)) {
      t.blocked(
        'Файлу docker-compose.yml у корені репозиторію ще немає.\n' +
          '    Крок 1 можна було робити руками, а ось крок 2 треба записати файлом.'
      );
    }

    const compose = fs.readFileSync(COMPOSE_PATH, 'utf8');

    t.check(
      'docker-compose.yml описує образ postgres',
      /image:\s*["']?postgres/i.test(compose),
      'Не бачу рядка виду  image: postgres:16'
    );

    t.check(
      'Порт 5432 проброшений назовні',
      /ports:/.test(compose) && /5432:\s*5432|["']5432:5432["']?/.test(compose),
      'Не бачу  ports:  з "5432:5432".\n' +
        'Зліва — порт на твоєму комп\'ютері, справа — порт усередині контейнера.\n' +
        'Без цього рядка база працює, але достукатись до неї ззовні неможливо.'
    );

    const mount = compose.match(/-\s*([^\s:#]+):\s*\/var\/lib\/postgresql\/data/);

    t.check(
      `Дані бази змонтовані в ${DATA_DIR}`,
      mount !== null,
      `Не бачу монтування в ${DATA_DIR}.\n` +
        'Саме за цим шляхом PostgreSQL усередині контейнера тримає свої файли.\n' +
        'Без тому вони зникнуть разом з контейнером — рівно як у кроці 1.'
    );

    if (mount) {
      const volumeName = mount[1];
      const isNamed = !volumeName.startsWith('.') && !volumeName.startsWith('/');

      t.check(
        `Це іменований том (${volumeName}), а не папка з твого диска`,
        isNamed,
        `Зараз туди змонтовано шлях "${volumeName}".\n` +
          'Так теж можна, але для бази краще іменований том: ним керує Docker,\n' +
          'він не залежить від прав на файли і не засмічує репозиторій.'
      );

      t.check(
        `Том ${volumeName} оголошений у секції volumes:`,
        /^volumes:/m.test(compose) && new RegExp(`^\\s{2,}${volumeName}:`, 'm').test(compose),
        'Іменований том треба ще й оголосити — окремою секцією на верхньому рівні:\n' +
          `\nvolumes:\n  ${volumeName}:`
      );
    }

    // --- а тепер найголовніше: чи воно справді працює ---
    const ping = await t.db.query('SELECT 1 AS ok');
    t.check(
      'База відповідає на запит',
      ping.rows.length === 1 && ping.rows[0].ok === 1,
      'Підключення є, але база поводиться дивно.'
    );

    const who = await t.db.query('SELECT current_database() AS db, current_user AS usr');
    t.check(
      'Підключаємось саме до бази todo під користувачем todo',
      who.rows[0].db === 'todo' && who.rows[0].usr === 'todo',
      `зараз це база "${who.rows[0].db}" і користувач "${who.rows[0].usr}".\n` +
        'Звір POSTGRES_DB і POSTGRES_USER у docker-compose.yml.\n' +
        'Якщо міняла їх уже після першого запуску — том лишився старий:\n' +
        '  docker compose down -v && docker compose up -d'
    );

    const version = await t.db.query('SHOW server_version');
    t.info(`\nПрацює PostgreSQL ${version.rows[0].server_version}`);
  },

  explain: `
    Спершу три слова, які часто плутають.

      ОБРАЗ (image)        шаблон, тільки для читання. "Postgres 16 з усім,
                           що йому треба для роботи". Лежить у тебе на диску
                           після docker pull.

      КОНТЕЙНЕР (container) запущений екземпляр образу. З одного образу можна
                           підняти хоч десять контейнерів — вони не знатимуть
                           один про одного.

      ТОМ (volume)         окреме сховище для даних. Живе незалежно і від
                           образу, і від контейнера.

    Аналогія, яка добре лягає: образ — це клас, контейнер — об'єкт, створений
    з цього класу, том — зовнішній файл, у який об'єкт пише.

    Чому контейнер взагалі потрібен. Postgres можна просто встановити в систему.
    Але тоді: версія буде одна на всі проєкти, видалити його чисто складно, а в
    колеги все одно буде інша версія й інші налаштування. Контейнер робить
    програму ізольованою і одноразовою: підняла, попрацювала, прибрала, слідів
    не лишилось. На сервері, до речі, працює рівно той самий образ, що й у тебе.

    Чому саме Compose, якщо docker run теж працює.

      1. Команда з кроку 1 — це шість рядків, які треба пам'ятати або шукати
         в історії терміналу. Файл не треба пам'ятати.
      2. Файл лежить у git. Колега робить git pull і docker compose up -d —
         у нього піднімається рівно те саме. Команду в чаті так не передаси.
      3. Сервісів зазвичай більше одного: база, Redis, черга. Compose описує
         їх разом, з однією командою на всіх.

    Compose — це не інший інструмент. Це той самий docker run, тільки записаний
    файлом замість набирання руками.

    І найважливіший висновок, заради якого крок 1 робився руками: контейнер
    одноразовий, і це нормально. Видалити й створити заново — буденна операція,
    а не аварія. Саме тому дані не можна тримати всередині контейнера: вони
    мають лежати на томі, який це переживе.

    Перевір сама, це вражає:
      docker compose down       # контейнера більше немає
      docker compose up -d      # новий контейнер
      ... дані на місці, бо том не чіпали

    А от "docker compose down -v" прибирає й том. Після цього дані зникають
    назавжди — і це єдиний спосіб почати з чистої бази, якщо раптом переплутала
    POSTGRES_USER чи POSTGRES_DB при першому запуску.

    Останнє. Пароль "todo" прямо у файлі — свідоме спрощення для навчання.
    У справжньому проєкті секрети не лежать у git ніколи: їх підставляють через
    змінні оточення або менеджер секретів. Запам'ятай цю різницю зараз, щоб
    потім не переучуватись.
  `,
};