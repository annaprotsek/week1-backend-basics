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
def get_todos():
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id, title, completed, created_at FROM todos ORDER BY id")
            rows = cur.fetchall()
    return rows


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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")