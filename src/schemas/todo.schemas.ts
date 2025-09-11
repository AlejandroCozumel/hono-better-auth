import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

export const CreateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').openapi({ example: 'Buy groceries' }),
  description: z.string().optional().openapi({ example: 'Milk, bread, eggs' }),
  completed: z.boolean().default(false).openapi({ example: false }),
});

export const TodoSchema = z.object({
  id: z.string().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  userId: z.string().openapi({ example: 'user_123' }),
  title: z.string().openapi({ example: 'Buy groceries' }),
  description: z.string().nullable().openapi({ example: 'Milk, bread, eggs' }),
  completed: z.boolean().openapi({ example: false }),
  createdAt: z.string().openapi({ example: '2024-01-01T00:00:00Z' }),
  updatedAt: z.string().nullable().openapi({ example: '2024-01-01T00:00:00Z' }),
});

export const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Something went wrong' }),
});

export const ValidationErrorSchema = z.object({
  errors: z.array(z.string()).openapi({ example: ['Title is required'] }),
});

export const getTodosRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Todos'],
  summary: 'Get all todos for authenticated user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(TodoSchema),
        },
      },
      description: 'List of todos',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Unauthorized',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

export const createTodoRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Todos'],
  summary: 'Create a new todo',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTodoSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TodoSchema,
        },
      },
      description: 'Todo created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ValidationErrorSchema,
        },
      },
      description: 'Validation error',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Unauthorized',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});