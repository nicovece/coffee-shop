import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts', // Where your tables are defined
  out: './drizzle', // Where to put migration files
  dialect: 'sqlite', // Database type
  dbCredentials: {
    url: './data.db', // SQLite file location
  },
});
