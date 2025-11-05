import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestMenuItem } from './helpers';
import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('DELETE /menu/:id - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ACT
    const response = await request(app).delete('/menu/abc');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent item', async () => {
    // ACT
    const response = await request(app).delete('/menu/999');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 404 for already soft-deleted item', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // Soft delete it
    testDb
      .update(menuItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(menuItems.id, item.id))
      .run();

    // ACT - Try to soft delete it again
    const response = await request(app).delete(`/menu/${item.id}`);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });
});

describe('DELETE /menu/:id - Business Logic - Soft Delete', () => {
  it('soft deletes item successfully', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT
    const response = await request(app).delete(`/menu/${item.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Item soft-deleted successfully');
    expect(response.body).toHaveProperty('deletedItem');
    expect(response.body.deletedItem.id).toBe(item.id);
    expect(response.body.deletedItem.name).toBe('Espresso');
  });

  it('sets deletedAt timestamp', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    // ACT
    const response = await request(app).delete(`/menu/${item.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.deletedItem).toHaveProperty('deletedAt');
    expect(response.body.deletedItem.deletedAt).toBeDefined();
    expect(response.body.deletedItem.deletedAt).not.toBeNull();

    // Verify deletedAt is a valid date string
    expect(typeof response.body.deletedItem.deletedAt).toBe('string');
    const deletedAt = new Date(response.body.deletedItem.deletedAt).getTime();
    expect(deletedAt).toBeGreaterThan(0);
  });

  it('updates updatedAt timestamp', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // Get original updatedAt
    const originalUpdatedAt = new Date(item.updatedAt).getTime();

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ACT
    const beforeDeleteTime = Date.now();
    const response = await request(app).delete(`/menu/${item.id}`);
    const afterDeleteTime = Date.now();

    // ASSERT
    expect(response.status).toBe(200);
    const updatedUpdatedAt = new Date(
      response.body.deletedItem.updatedAt
    ).getTime();

    // updatedAt should have changed (or at least be >= original)
    expect(updatedUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    expect(updatedUpdatedAt).toBeGreaterThanOrEqual(beforeDeleteTime - 2000);
    expect(updatedUpdatedAt).toBeLessThanOrEqual(afterDeleteTime + 2000);
  });

  it('returns 200 with deleted item', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Mocha',
      price: 4.5,
      description: 'Espresso with chocolate',
    });

    // ACT
    const response = await request(app).delete(`/menu/${item.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deletedItem');

    // Verify deleted item has all required fields
    const deletedItem = response.body.deletedItem;
    expect(deletedItem).toHaveProperty('id');
    expect(deletedItem).toHaveProperty('name');
    expect(deletedItem).toHaveProperty('price');
    expect(deletedItem).toHaveProperty('description');
    expect(deletedItem).toHaveProperty('createdAt');
    expect(deletedItem).toHaveProperty('updatedAt');
    expect(deletedItem).toHaveProperty('deletedAt');

    // Verify field values
    expect(deletedItem.id).toBe(item.id);
    expect(deletedItem.name).toBe('Mocha');
    expect(deletedItem.price).toBe(4.5);
    expect(deletedItem.description).toBe('Espresso with chocolate');
    expect(deletedItem.deletedAt).not.toBeNull();
  });
});

describe('DELETE /menu/:id - Business Logic - Exclusion from Queries', () => {
  it('soft-deleted item no longer appears in GET /menu', async () => {
    // ARRANGE - Create multiple items
    const item1 = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });
    const item2 = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });
    const item3 = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // Soft delete the middle item
    await request(app).delete(`/menu/${item2.id}`);

    // ACT
    const response = await request(app).get('/menu');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2);

    // Verify item2 is not in the results
    const itemIds = response.body.map((item: { id: number }) => item.id);
    expect(itemIds).toContain(item1.id);
    expect(itemIds).toContain(item3.id);
    expect(itemIds).not.toContain(item2.id);
  });

  it('soft-deleted item no longer appears in GET /menu/:id', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Mocha',
      price: 4.5,
      description: 'Espresso with chocolate',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // ACT
    const response = await request(app).get(`/menu/${item.id}`);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('soft-deleted item no longer appears in GET /menu/name/:coffeeName', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Americano',
      price: 3.0,
      description: 'Espresso with hot water',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // ACT
    const response = await request(app).get('/menu/name/Americano');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('soft-deleted item no longer appears in GET /menu/price/:maxPrice', async () => {
    // ARRANGE - Create items with different prices
    const item1 = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });
    const item2 = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });
    const item3 = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // Soft delete item2 (price 3.5)
    await request(app).delete(`/menu/${item2.id}`);

    // ACT - Query for items with price <= 4.0 (should include item1 and item3, but not item2)
    const response = await request(app).get('/menu/price/4.0');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2);

    // Verify item2 is not in the results
    const itemIds = response.body.map((item: { id: number }) => item.id);
    expect(itemIds).toContain(item1.id);
    expect(itemIds).toContain(item3.id);
    expect(itemIds).not.toContain(item2.id);
  });
});

describe('DELETE /menu/:id/hard-delete - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ACT
    const response = await request(app).delete('/menu/abc/hard-delete');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent item', async () => {
    // ACT
    const response = await request(app).delete('/menu/999/hard-delete');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 400 for active item (not soft-deleted)', async () => {
    // ARRANGE - Create an active item (not soft-deleted)
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT - Try to hard delete an active item
    const response = await request(app).delete(`/menu/${item.id}/hard-delete`);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Cannot hard delete active item');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Item must be soft-deleted first');
  });
});

describe('DELETE /menu/:id/hard-delete - Business Logic - Hard Delete', () => {
  it('hard deletes soft-deleted item successfully', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // Soft delete it first
    await request(app).delete(`/menu/${item.id}`);

    // ACT - Hard delete it
    const response = await request(app).delete(`/menu/${item.id}/hard-delete`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Item deleted successfully');
    expect(response.body).toHaveProperty('deletedItem');
    expect(response.body.deletedItem.id).toBe(item.id);
    expect(response.body.deletedItem.name).toBe('Espresso');
  });

  it('returns 200 with deleted item info', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    // Soft delete it first
    await request(app).delete(`/menu/${item.id}`);

    // ACT - Hard delete it
    const response = await request(app).delete(`/menu/${item.id}/hard-delete`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deletedItem');

    // Verify deleted item has all required fields
    const deletedItem = response.body.deletedItem;
    expect(deletedItem).toHaveProperty('id');
    expect(deletedItem).toHaveProperty('name');
    expect(deletedItem).toHaveProperty('price');
    expect(deletedItem).toHaveProperty('description');
    expect(deletedItem).toHaveProperty('createdAt');
    expect(deletedItem).toHaveProperty('updatedAt');
    expect(deletedItem).toHaveProperty('deletedAt');

    // Verify field values
    expect(deletedItem.id).toBe(item.id);
    expect(deletedItem.name).toBe('Cappuccino');
    expect(deletedItem.price).toBe(3.5);
    expect(deletedItem.description).toBe('Espresso with steamed milk foam');
  });

  it('item is permanently removed from database', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // Soft delete it first
    await request(app).delete(`/menu/${item.id}`);

    // ACT - Hard delete it
    const response = await request(app).delete(`/menu/${item.id}/hard-delete`);
    expect(response.status).toBe(200);

    // ASSERT - Verify item no longer exists in database (even with direct query)
    const deletedItem = testDb
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, item.id))
      .get();

    expect(deletedItem).toBeUndefined();

    // Also verify it's not accessible via API endpoints
    const getResponse = await request(app).get(`/menu/${item.id}`);
    expect(getResponse.status).toBe(404);
    expect(getResponse.body.error).toBe('Item not found');
  });
});
