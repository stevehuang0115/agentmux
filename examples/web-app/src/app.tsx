/**
 * Todo App — React Frontend
 *
 * Frontend Dev: Start here — build the UI components for the todo app.
 * Coordinate with Backend Dev on the API contract at /api/todos.
 */

import React, { useState, useEffect } from 'react';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

const API_URL = 'http://localhost:3001/api/todos';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(setTodos)
      .catch(console.error);
  }, []);

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    const todo = await res.json();
    setTodos([...todos, todo]);
    setNewTitle('');
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !todo.completed }),
    });
    const updated = await res.json();
    setTodos(todos.map(t => (t.id === id ? updated : t)));
  };

  const deleteTodo = async (id: string) => {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Todo App</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="What needs to be done?"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={addTodo}>Add</button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map(todo => (
          <li key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{ flex: 1, textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.title}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && <p style={{ color: '#888' }}>No todos yet. Add one above!</p>}
    </div>
  );
}
