import { beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

// Create in-memory test database
const sqlite = new Database(':memory:');
sqlite.pragma('journal_mode = WAL');

export const testDb = drizzle(sqlite, { schema });

// Create tables before running tests
beforeAll(() => {
  // Create menu_items table
  sqlite.exec(`
    CREATE TABLE menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price REAL NOT NULL,
      description TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    )
  `);

  // Create store_hours table
  sqlite.exec(`
    CREATE TABLE store_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monday TEXT NOT NULL,
      tuesday TEXT NOT NULL,
      wednesday TEXT NOT NULL,
      thursday TEXT NOT NULL,
      friday TEXT NOT NULL,
      saturday TEXT NOT NULL,
      sunday TEXT NOT NULL
    )
  `);

  // Create daily_special table
  sqlite.exec(`
    CREATE TABLE daily_special (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      valid_from INTEGER,
      valid_to INTEGER
    )
  `);
});

// Clear data before each test
beforeEach(async () => {
  testDb.delete(schema.menuItems).run();
  testDb.delete(schema.hours).run();
  testDb.delete(schema.special).run();
});

// Close database after all tests
afterAll(() => {
  sqlite.close();
});
