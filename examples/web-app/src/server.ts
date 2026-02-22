/**
 * Todo API Server
 *
 * Express server with CRUD endpoints for todos.
 * Backend Dev: Start here — implement the API routes and data layer.
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Todo data model ---

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

const todos: Todo[] = [];

// --- Routes ---

// GET /api/todos — List all todos
app.get('/api/todos', (_req, res) => {
  res.json(todos);
});

// POST /api/todos — Create a new todo
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const todo: Todo = {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };

  todos.push(todo);
  res.status(201).json(todo);
});

// PATCH /api/todos/:id — Toggle or update a todo
app.patch('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === req.params.id);
  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  if (req.body.title !== undefined) todo.title = req.body.title;
  if (req.body.completed !== undefined) todo.completed = req.body.completed;

  res.json(todo);
});

// DELETE /api/todos/:id — Delete a todo
app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  todos.splice(index, 1);
  res.status(204).send();
});

// --- Start server ---

app.listen(PORT, () => {
  console.log(`Todo API running at http://localhost:${PORT}`);
});
