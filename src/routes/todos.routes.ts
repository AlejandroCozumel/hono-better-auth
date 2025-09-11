import { OpenAPIHono } from '@hono/zod-openapi';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getTodosByUserId, insertTodo } from '../db/queries/todos';
import type { HonoEnv } from '../types/auth';
import { getTodosRoute, createTodoRoute } from '../schemas/todo.schemas';

export const todos = new OpenAPIHono<HonoEnv>();

todos.use(authMiddleware);

todos.openapi(getTodosRoute, async (c) => {
  const user = c.get('user');

  try {
    const todoList = await getTodosByUserId(user.id);
    return c.json(todoList);
  } catch (error) {
    console.error('Error fetching todos: ', error);
    return c.json({ error: 'Failed to fetch todos' }, 500);
  }
});

todos.openapi(createTodoRoute, async (c) => {
  const user = c.get('user');
  const todoData = c.req.valid('json');

  try {
    const newTodo = await insertTodo({
      ...todoData,
      userId: user.id,
    });
    return c.json(newTodo, 201);
  } catch (error) {
    console.error('Error creating todo: ', error);
    return c.json({ error: 'Failed to create todo' }, 500);
  }
});