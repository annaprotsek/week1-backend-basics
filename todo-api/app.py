import os
import uvicorn
from fastapi import FastAPI, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel, StrictStr, StrictBool
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row


app = FastAPI()

pool = ConnectionPool(os.environ["DATABASE_URL"], min_size=1, max_size=5)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": "invalid request body"})

@app.get("/todos")
def get_todos(completed: str | None = None, limit: str | None = None, offset: str | None = None):
    where, params = [], []

    if completed is not None:
        if completed not in ("true", "false"):
            raise HTTPException(status_code=400, detail="completed must be true or false")
        where.append("completed = %s")
        params.append(completed == "true")

    if limit is None:
        limit_value = 20
    else:
        try:
            limit_value = int(limit)
        except ValueError:
            raise HTTPException(status_code=400, detail="limit must be an integer")
        if limit_value < 1 or limit_value > 100:
            raise HTTPException(status_code=400, detail="limit must be between 1 and 100")

    if offset is None:
        offset_value = 0
    else:
        try:
            offset_value = int(offset)
        except ValueError:
            raise HTTPException(status_code=400, detail="offset must be an integer")
        if offset_value < 0:
            raise HTTPException(status_code=400, detail="offset must be 0 or greater")

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"SELECT COUNT(*) AS n FROM todos {where_sql}", params)
            total = cur.fetchone()["n"]

            cur.execute(
                f"SELECT * FROM todos {where_sql} ORDER BY id LIMIT %s OFFSET %s",
                params + [limit_value, offset_value],
            )
            items = cur.fetchall()

    return {"items": items, "total": total, "limit": limit_value, "offset": offset_value}


class TodoCreate(BaseModel):
    title: StrictStr
    completed: StrictBool | None = None


@app.post("/todos", status_code=201)
def create_todo(body: TodoCreate, response: Response):
    if not body.title:
        raise HTTPException(status_code=400, detail="title is required")

    completed = False if body.completed is None else body.completed

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "INSERT INTO todos (title, completed) VALUES (%s, %s) RETURNING *",
                [body.title, completed],
            )
            todo = cur.fetchone()

    response.headers["Location"] = f"/todos/{todo['id']}"
    return todo


class TodoUpdate(BaseModel):
    title: StrictStr | None = None
    completed: StrictBool | None = None


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: int, body: TodoUpdate):
    if body.title is not None and not body.title:
        raise HTTPException(status_code=400, detail="title must not be empty")

    sets, params = [], []
    if body.title is not None:
        sets.append("title = %s")
        params.append(body.title)
    if body.completed is not None:
        sets.append("completed = %s")
        params.append(body.completed)

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if sets:
                params.append(todo_id)
                cur.execute(
                    f"UPDATE todos SET {', '.join(sets)} WHERE id = %s RETURNING *",
                    params,
                )
            else:
                cur.execute("SELECT * FROM todos WHERE id = %s", [todo_id])
            todo = cur.fetchone()

    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("DELETE FROM todos WHERE id = %s RETURNING id", [todo_id])
            row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return None


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")