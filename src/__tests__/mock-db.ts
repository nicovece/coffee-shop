import { vi } from 'vitest';
import { testDb } from './setup';

// Mock the database module
vi.mock('../db/index', () => ({
  db: testDb,
}));
