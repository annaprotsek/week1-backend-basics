# todo-api — тиждень 3

Новий застосунок: той самий звичний TODO, але дані тепер живуть у PostgreSQL,
а не в масиві.

`index.js` і `python/app.py` з попередніх тижнів **не чіпаємо** — вони лишаються
робочими, і їхні таски мають і далі бути зеленими.

---

## 1. База

Піднімається з `docker-compose.yml` у корені репозиторію (таск 17):

```bash
docker compose up -d        # підняти
docker compose ps           # перевірити, що живий
docker compose logs db      # якщо щось не так
docker compose down         # прибрати контейнер (том лишається)
docker compose down -v      # прибрати разом з даними — обережно
```

Зайти в psql усередині контейнера:

```bash
docker compose exec db psql -U todo -d todo
```

Корисне в psql: `\dt` — список таблиць · `\d todos` — опис таблиці · `\q` — вийти.

---

## 2. Оточення Python

Так само, як було в `python/` на таску 15 — але своє, окреме:

```bash
cd todo-api
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Перевірка сама знайде `todo-api/.venv` — активувати оточення руками потрібно
лише тоді, коли запускаєш сервер власноруч.

`requirements.txt` має містити щонайменше:

```
fastapi
uvicorn
psycopg[binary]
```

Версії краще зафіксувати точно (`==`), щоб у тебе і в мене поставилось однакове.

---

## 3. Запуск застосунку

```bash
DATABASE_URL=postgres://todo:todo@localhost:5432/todo PORT=3000 python app.py
```

Обидві змінні беруться з оточення — у коді їх прописувати не треба:

```python
import os
DATABASE_URL = os.environ["DATABASE_URL"]
PORT = int(os.environ.get("PORT", 3000))
```

Перевірка підставляє їх сама і щоразу піднімає сервер на вільному порті.

---

## 4. Перевірка

```bash
node exercises/run.js          # таски поточного тижня, по одному
node exercises/run.js 21       # конкретний
node exercises/run.js --all-weeks   # разом з тижнями 1-2
```

**Важливо:** перевірка щоразу чистить таблицю `todos` і кладе туди свої рядки.
Це нормально — не тримай у ній нічого, що шкода втратити.

---

## 5. Якщо щось не працює

| Симптом | Що це означає |
|---|---|
| `Не можу підключитись до бази` | контейнер не піднятий → `docker compose up -d` |
| `бази "todo" там немає` | переплутаний `POSTGRES_DB`, або том створений зі старими значеннями → `docker compose down -v && docker compose up -d` |
| `не пускає: невірний користувач або пароль` | те саме, але про `POSTGRES_USER` / `POSTGRES_PASSWORD` |
| `У базі немає таблиці todos` | таблиця ще не створена → таск 19 |
| `немає файлу todo-api/app.py` | застосунок ще не створений → таск 20 |
| сервер не стартує, а в логах `ModuleNotFoundError` | не поставлені залежності → `pip install -r requirements.txt` в активованому `.venv` |

---

## 6. Що з'явиться по ходу тижня

```
todo-api/
├── README.md             ← цей файл
├── requirements.txt      таск 20
├── app.py                таск 20, далі дописується
├── migrations/           таск 24
│   ├── 001_init.sql
│   └── 002_add_priority.sql
└── .venv/                не потрапляє в git
```