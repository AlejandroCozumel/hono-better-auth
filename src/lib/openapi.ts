import { OpenAPIHono } from '@hono/zod-openapi';
import type { HonoEnv } from '@/types/auth';

export const createOpenAPIApp = () => {
  const app = new OpenAPIHono<HonoEnv>();
  return app;
};