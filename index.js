const express = require('express');
const app = express();
const PORT = 3000;

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
  const newUser = { id: users.length + 1, name, email };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
