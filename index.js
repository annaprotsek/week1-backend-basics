const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const users = [
  { id: 1, name: 'Anna', email: 'anna@example.com' },
  { id: 2, name: 'Bohdan', email: 'bohdan@example.com' },
  { id: 3, name: 'Olena', email: 'olena@example.com' },
];

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

app.get('/users', (req, res) => {
  res.json(users);
});

app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  const newUser = { id: Math.max(...users.map(u => u.id), 0) + 1, name, email };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.put('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { name, email } = req.body;
  if (name) user.name = name;
  if (email) user.email = email;
  res.json(user);
});

app.delete('/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  users.splice(index, 1);
  res.status(204).send();
});

const todos = [
  { id: 1, title: 'Learn API', completed: false },
  { id: 2, title: 'Build Todo app', completed: true },
];

app.get('/todos', (req, res) => {
  const { completed } = req.query;
  if (completed === undefined) {
    return res.json(todos);
  }
  const isCompleted = completed === 'true';
  res.json(todos.filter((t) => t.completed === isCompleted));
});

app.get('/todos/:id', (req, res) => {
  const todo = todos.find((t) => t.id === Number(req.params.id));
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  res.json(todo);
});

app.post('/todos', (req, res) => {
  const { title, completed } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean' });
  }
  const newTodo = {
    id: Math.max(...todos.map(t => t.id), 0) + 1,
    title,
    completed: completed === undefined ? false : completed,
  };
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

app.put('/todos/:id', (req, res) => {
  const todo = todos.find((t) => t.id === Number(req.params.id));
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  const { title, completed } = req.body;
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean' });
  }
  if (title !== undefined) todo.title = title;
  if (completed !== undefined) todo.completed = completed;
  res.json(todo);
});

app.delete('/todos/:id', (req, res) => {
  const index = todos.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }
  todos.splice(index, 1);
  res.status(204).send();
});

const products = []

app.get('/products', (req, res) => {
  const { maxPrice, search } = req.query;
  let result = products;

  if (maxPrice !== undefined) {
    const max = Number(maxPrice);
    if (Number.isNaN(max)) {
      return res.status(400).json({ error: 'maxPrice must be a number' });
    }
    result = result.filter((p) => p.price <= max);
  }

  if (search !== undefined) {
    result = result.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }

  res.json(result);
});

app.get('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

app.post('/products', (req, res) => {
  const { name, price, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'price must be a number greater than 0' });
  }

  const newProduct = {
    id: Math.max(...products.map((p) => p.id), 0) + 1,
    name,
    price,
    description: description === undefined ? '' : description,
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

app.put('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { name, price, description } = req.body;

  if (name !== undefined && !name) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (price !== undefined && (typeof price !== 'number' || price <= 0)) {
    return res.status(400).json({ error: 'price must be a number greater than 0' });
  }

  if (name !== undefined) product.name = name;
  if (price !== undefined) product.price = price;
  if (description !== undefined) product.description = description;

  res.json(product);
});

app.delete('/products/:id', (req, res) => {
  const index = products.findIndex((p) => p.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  products.splice(index, 1);
  res.status(204).send();
});

app.post('/debug/echo/:id', (req, res) => {
  res.json({ params: req.params, query: req.query, body: req.body });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
