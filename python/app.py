from fastapi import FastAPI

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI()


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": "invalid request body"})


@app.get("/hello")
async def hello():
    return {"message": "Hello, World!"}


from pydantic import BaseModel, StrictStr, StrictInt, StrictFloat

users = [
    {"id": 1, "name": "Anna", "email": "anna@example.com"},
    {"id": 2, "name": "Bohdan", "email": "bohdan@example.com"},
    {"id": 3, "name": "Olena", "email": "olena@example.com"},
]


def parse_id(raw_id: str):
    try:
        return int(raw_id)
    except ValueError:
        return None


class UserCreate(BaseModel):
    name: StrictStr
    email: StrictStr


class UserUpdate(BaseModel):
    name: StrictStr | None = None
    email: StrictStr | None = None


@app.get("/users")
async def get_users():
    return users


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    user = next((u for u in users if u["id"] == parse_id(user_id)), None)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/users", status_code=201)
async def create_user(body: UserCreate):
    if not body.name or not body.email:
        raise HTTPException(status_code=400, detail="name and email are required")
    new_id = max((u["id"] for u in users), default=0) + 1
    new_user = {"id": new_id, "name": body.name, "email": body.email}
    users.append(new_user)
    return new_user


@app.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate):
    user = next((u for u in users if u["id"] == parse_id(user_id)), None)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name:
        user["name"] = body.name
    if body.email:
        user["email"] = body.email
    return user


@app.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str):
    index = next((i for i, u in enumerate(users) if u["id"] == parse_id(user_id)), -1)
    if index == -1:
        raise HTTPException(status_code=404, detail="User not found")
    users.pop(index)
    return None


from pydantic import StrictBool

todos = [
    {"id": 1, "title": "Learn API", "completed": False},
    {"id": 2, "title": "Build Todo app", "completed": True},
]


class TodoCreate(BaseModel):
    title: StrictStr
    completed: StrictBool | None = None


class TodoUpdate(BaseModel):
    title: StrictStr | None = None
    completed: StrictBool | None = None


@app.get("/todos")
async def get_todos(completed: str | None = None):
    if completed is None:
        return todos
    is_completed = completed == "true"
    return [t for t in todos if t["completed"] == is_completed]


@app.get("/todos/{todo_id}")
async def get_todo(todo_id: str):
    todo = next((t for t in todos if t["id"] == parse_id(todo_id)), None)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@app.post("/todos", status_code=201)
async def create_todo(body: TodoCreate):
    if not body.title:
        raise HTTPException(status_code=400, detail="title is required")
    new_id = max((t["id"] for t in todos), default=0) + 1
    new_todo = {
        "id": new_id,
        "title": body.title,
        "completed": False if body.completed is None else body.completed,
    }
    todos.append(new_todo)
    return new_todo


@app.put("/todos/{todo_id}")
async def update_todo(todo_id: str, body: TodoUpdate):
    todo = next((t for t in todos if t["id"] == parse_id(todo_id)), None)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    if body.title is not None:
        todo["title"] = body.title
    if body.completed is not None:
        todo["completed"] = body.completed
    return todo


@app.delete("/todos/{todo_id}", status_code=204)
async def delete_todo(todo_id: str):
    index = next((i for i, t in enumerate(todos) if t["id"] == parse_id(todo_id)), -1)
    if index == -1:
        raise HTTPException(status_code=404, detail="Todo not found")
    todos.pop(index)
    return None


from typing import Union
from fastapi import Response


class ProductCreate(BaseModel):
    name: StrictStr
    price: Union[StrictInt, StrictFloat]
    description: StrictStr | None = None


class ProductUpdate(BaseModel):
    name: StrictStr | None = None
    price: Union[StrictInt, StrictFloat] | None = None
    description: StrictStr | None = None


products = []


@app.get("/products")
async def get_products(maxPrice: str | None = None, search: str | None = None):
    result = products
    if maxPrice is not None:
        try:
            max_price = float(maxPrice)
        except ValueError:
            raise HTTPException(status_code=400, detail="maxPrice must be a number")
        result = [p for p in result if p["price"] <= max_price]
    if search is not None:
        result = [p for p in result if search.lower() in p["name"].lower()]
    return result


@app.get("/products/{product_id}")
async def get_product(product_id: str):
    product = next((p for p in products if p["id"] == parse_id(product_id)), None)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.post("/products", status_code=201)
async def create_product(body: ProductCreate, response: Response):
    if not body.name:
        raise HTTPException(status_code=400, detail="name is required")
    if body.price <= 0:
        raise HTTPException(status_code=400, detail="price must be a number greater than 0")

    duplicate = any(p["name"].lower() == body.name.lower() for p in products)
    if duplicate:
        raise HTTPException(status_code=409, detail="product with this name already exists")

    new_id = max((p["id"] for p in products), default=0) + 1
    new_product = {
        "id": new_id,
        "name": body.name,
        "price": body.price,
        "description": "" if body.description is None else body.description,
    }
    products.append(new_product)
    response.headers["Location"] = f"/products/{new_id}"
    return new_product


def apply_product_update(product: dict, body: ProductUpdate):
    if body.name is not None:
        if not body.name:
            raise HTTPException(status_code=400, detail="name cannot be empty")
        product["name"] = body.name
    if body.price is not None:
        if body.price <= 0:
            raise HTTPException(status_code=400, detail="price must be a number greater than 0")
        product["price"] = body.price
    if body.description is not None:
        product["description"] = body.description


@app.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate):
    product = next((p for p in products if p["id"] == parse_id(product_id)), None)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    apply_product_update(product, body)
    return product


@app.patch("/products/{product_id}")
async def patch_product(product_id: str, body: ProductUpdate):
    product = next((p for p in products if p["id"] == parse_id(product_id)), None)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    apply_product_update(product, body)
    return product


@app.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: str):
    index = next((i for i, p in enumerate(products) if p["id"] == parse_id(product_id)), -1)
    if index == -1:
        raise HTTPException(status_code=404, detail="Product not found")
    products.pop(index)
    return None


orders = []


def build_order_item(item: dict, index: int):
    qty = item.get("qty")
    if not isinstance(qty, int) or isinstance(qty, bool) or qty <= 0:
        return None, f"items[{index}].qty must be an integer greater than 0"

    product_id = item.get("productId")
    product = next((p for p in products if p["id"] == product_id), None)
    if product is None:
        return None, f"items[{index}].productId does not exist"

    built = {
        "productId": product_id,
        "name": product["name"],
        "qty": qty,
        "price": product["price"],
        "subtotal": product["price"] * qty,
    }
    return built, None


class OrderCreate(BaseModel):
    customer: StrictStr | None = None
    items: list[dict] | None = None


@app.post("/orders", status_code=201)
async def create_order(body: OrderCreate, response: Response):
    if not body.customer:
        raise HTTPException(status_code=400, detail="customer is required")
    if not body.items:
        raise HTTPException(status_code=400, detail="items must be a non-empty array")

    built_items = []
    for index, item in enumerate(body.items):
        built, error = build_order_item(item, index)
        if error is not None:
            raise HTTPException(status_code=400, detail=error)
        built_items.append(built)

    total = sum(item["subtotal"] for item in built_items)

    new_id = max((o["id"] for o in orders), default=0) + 1
    new_order = {
        "id": new_id,
        "customer": body.customer,
        "items": built_items,
        "total": total,
    }
    orders.append(new_order)
    response.headers["Location"] = f"/orders/{new_id}"
    return new_order


@app.get("/orders")
async def get_orders(limit: str | None = None, offset: str | None = None):
    limit_value = 20
    if limit is not None:
        try:
            limit_value = int(limit)
        except ValueError:
            raise HTTPException(status_code=400, detail="limit must be an integer between 1 and 100")
        if limit_value < 1 or limit_value > 100:
            raise HTTPException(status_code=400, detail="limit must be an integer between 1 and 100")

    offset_value = 0
    if offset is not None:
        try:
            offset_value = int(offset)
        except ValueError:
            raise HTTPException(status_code=400, detail="offset must be a non-negative integer")
        if offset_value < 0:
            raise HTTPException(status_code=400, detail="offset must be a non-negative integer")

    sorted_orders = sorted(orders, key=lambda o: o["id"])

    return {
        "items": sorted_orders[offset_value:offset_value + limit_value],
        "total": len(orders),
        "limit": limit_value,
        "offset": offset_value,
    }


@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = next((o for o in orders if o["id"] == parse_id(order_id)), None)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


from fastapi import Request


@app.post("/debug/echo/{id}")
async def debug_echo(id: str, request: Request):
    body = await request.json()
    return {"params": {"id": id}, "query": dict(request.query_params), "body": body}


import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Server running on http://localhost:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
