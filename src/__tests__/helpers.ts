import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { sql, eq } from 'drizzle-orm';

/**
 * Helper to create a test menu item
 * Reduces boilerplate in tests
 */
export const createTestMenuItem = async (overrides = {}) => {
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

  return created;
};

/**
 * Helper to create multiple test menu items
 */
export const createTestMenuItems = async (count: number) => {
  const items = [];
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

/**
 * Helper to soft-delete a menu item by ID
 */
export const softDeleteMenuItem = async (id: number) => {
  testDb
    .update(menuItems)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, id))
    .run();

  return testDb.select().from(menuItems).where(eq(menuItems.id, id)).get();
};
