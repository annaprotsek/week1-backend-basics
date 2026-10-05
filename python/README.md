# Таск 15 — той самий API на Python (FastAPI)

Додаткове завдання. Беремось за нього, коли таски 01–14 зелені.

Мета не в тому, щоб вивчити Python. Мета — побачити на власному прикладі, що
**контракт не залежить від мови**: ті самі адреси, статуси й тіла, а всередині
інша мова, інший фреймворк, інший підхід до валідації. Доказ буде буквальний —
ті самі перевірки проженуться проти Python-сервера.

`index.js` при цьому **не чіпаємо взагалі**.

---

## 1. Оточення

```bash
cd python
python3 -m venv .venv          # окреме оточення тільки для цього проєкту
source .venv/bin/activate      # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
```

`venv` — це папка зі своїм власним Python і своїми бібліотеками. Потрібна,
щоб пакети цього проєкту не змішувалися з системними й з іншими проєктами.
Приблизно те саме, що `node_modules`, тільки для Python.

Перевірка запускає Python сама і сама знайде `python/.venv` — активувати
оточення руками потрібно лише тоді, коли запускаєш сервер власноруч.

## 2. Файл, який треба створити

Один файл: `python/app.py`.

В самому кінці він має вміти запускатись напряму і брати порт із оточення —
рівно з тієї ж причини, що й `index.js` (перевірка щоразу піднімає сервер на
вільному порті):

```python
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Server running on http://localhost:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
```

Запустити руками:

```bash
python app.py                 # http://localhost:8000
```

Коли сервер запущено, відкрий **http://localhost:8000/docs** — FastAPI сам
малює сторінку з усіма твоїми endpoint'ами, де кожен можна поклацати.
Це не магія: він будує її з того самого опису (OpenAPI), який згодом
використовують для генерації типів фронтенду.

## 3. Що саме має бути всередині

Рівно те, що вже є в `index.js`. Стартові дані — ті самі:

```python
users = [
    {"id": 1, "name": "Anna",   "email": "anna@example.com"},
    {"id": 2, "name": "Bohdan", "email": "bohdan@example.com"},
    {"id": 3, "name": "Olena",  "email": "olena@example.com"},
]
todos = [
    {"id": 1, "title": "Learn API",      "completed": False},
    {"id": 2, "title": "Build Todo app", "completed": True},
]
products = []
orders = []
```

| Endpoint | Коротко |
|---|---|
| `GET /hello` | `{ "message": "Hello, World!" }` |
| `GET /users` · `GET /users/{id}` · `POST /users` · `PUT /users/{id}` · `DELETE /users/{id}` | CRUD, як у тасках 01–04 |
| `GET /todos?completed=` · `GET /todos/{id}` · `POST /todos` · `PUT /todos/{id}` · `DELETE /todos/{id}` | фільтр + сувора перевірка `completed` (таск 05) |
| `GET /products?maxPrice=&search=` · `GET /products/{id}` · `POST /products` · `PUT /products/{id}` · `PATCH /products/{id}` · `DELETE /products/{id}` | таски 06, 07, 10, 11 |
| `POST /orders` · `GET /orders/{id}` · `GET /orders` | таски 12, 13 |
| `POST /debug/echo/{id}` | таск 02 |
| будь-яка інша адреса | 404 і `{ "error": "..." }` (таск 09) |

Форма помилки одна на весь API: `{ "error": "текст" }`.

## 4. Чотири місця, де Python поведеться не так, як ти очікуєш

Це не дрібниці — це і є зміст таска.

**1. FastAPI віддає 422, а не 400.** На невалідне тіло він відповідає
`422 Unprocessable Entity` і полем `detail`. Наш контракт каже `400` і `error`.
Перемагає контракт — потрібен свій обробник:

```python
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"error": "..."})
```

Те саме знадобиться для `HTTPException` (щоб замість `detail` було `error`)
і для 404 на невідому адресу.

**2. pydantic за замовчуванням «допомагає» з типами.** `completed: bool` спокійно
проковтне рядок `"yes"` і перетворить його на `True` — тобто рівно той баг, який
ти лагодила в таску 05. Потрібен суворий тип: `StrictBool`, `StrictInt`,
`StrictStr` (або `model_config = ConfigDict(strict=True)`).

**3. Зайві поля в тілі pydantic мовчки викидає** — це те, що в таску 10 ти
робила руками (білий список полів). Тут воно вже вбудоване. Якщо хочеться,
щоб зайве поле було помилкою, а не мовчанням: `model_config = ConfigDict(extra="forbid")`.

**4. `params.id` має лишитись текстом.** У `POST /debug/echo/{id}` спокуса
написати `id: int` — і FastAPI сам перетворить `"15"` на `15`. Але таск 02 саме
про те, що в адресі завжди приїжджає ТЕКСТ. Лишай `id: str`.

## 5. Як перевірити

```bash
# з кореня проєкту, не з папки python/
node exercises/run.js 15                      # швидкий прогін контракту
node exercises/run.js --all --target=python   # УСІ таски проти Python-сервера
```

Друга команда — це фініш. Вона бере ті самі перевірки, які ти проходила на
Node, і проганяє їх проти Python. Якщо все зелене — контракт справді один,
а мова справді деталь реалізації.