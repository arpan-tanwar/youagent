import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './youagent.db',
  },
} satisfies Config;

