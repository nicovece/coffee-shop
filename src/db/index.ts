import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// 1. Create SQLite connection
const sqlite = new Database('./data.db');

// 2. Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

// 3. Create Drizzle instance
export const db = drizzle(sqlite, { schema });
