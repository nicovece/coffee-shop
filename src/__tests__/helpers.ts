import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { sql, eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type MenuItem = InferSelectModel<typeof menuItems>;

/**
 * Helper to create a test menu item
 * Reduces boilerplate in tests
 */
export const createTestMenuItem = async (overrides = {}): Promise<MenuItem> => {
  const defaultItem = {
    name: 'Test Coffee',
    price: 2.99,
    description: 'A delicious test coffee item',
  };

  const item = { ...defaultItem, ...overrides };

  testDb.insert(menuItems).values(item).run();

  // Return the created item
  const created = testDb
    .select()
    .from(menuItems)
    .where(sql`LOWER(${menuItems.name}) = LOWER(${item.name})`)
    .get();

  // This should never be undefined since we just inserted the item
  if (!created) {
    throw new Error(`Failed to retrieve created menu item: ${item.name}`);
  }

  return created;
};

/**
 * Helper to create multiple test menu items
 */
export const createTestMenuItems = async (
  count: number
): Promise<MenuItem[]> => {
  const items: MenuItem[] = [];
  for (let i = 1; i <= count; i++) {
    const item = await createTestMenuItem({
      name: `Test Coffee ${i}`,
      price: 2.99 + i,
      description: `Test description ${i}`,
    });
    items.push(item);
  }
  return items;
};
