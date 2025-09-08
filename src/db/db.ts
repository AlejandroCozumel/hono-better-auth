import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "@/db/schema";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });
