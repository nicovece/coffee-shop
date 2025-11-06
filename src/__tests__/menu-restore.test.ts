import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestMenuItem } from './helpers';
import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('POST /menu/:id/restore - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ACT
    const response = await request(app).post('/menu/abc/restore');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent item', async () => {
    // ACT
    const response = await request(app).post('/menu/999/restore');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 400 for item that is not deleted', async () => {
    // ARRANGE - Create an active (non-deleted) item
    const item = await createTestMenuItem({
      name: 'Active Coffee',
      price: 3.5,
      description: 'This item is not deleted',
    });

    // ACT - Try to restore it
    const response = await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item is not deleted');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(
      'This item is already active and does not need to be restored',
    );
  });
});

describe('POST /menu/:id/restore - Business Logic', () => {
  it('restores soft-deleted item successfully', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // ACT - Restore it
    const response = await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Item restored successfully');
    expect(response.body).toHaveProperty('restoredItem');
    expect(response.body.restoredItem.id).toBe(item.id);
    expect(response.body.restoredItem.name).toBe('Espresso');
  });

  it('clears deletedAt timestamp (sets to null)', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // Verify deletedAt is set
    const deletedItem = testDb
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, item.id))
      .get();
    expect(deletedItem?.deletedAt).toBeDefined();
    expect(deletedItem?.deletedAt).not.toBeNull();

    // ACT - Restore it
    const response = await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.restoredItem).toHaveProperty('deletedAt');
    expect(response.body.restoredItem.deletedAt).toBeNull();
  });

  it('updates updatedAt timestamp', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // Get original updatedAt
    const deletedItem = testDb
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, item.id))
      .get();
    const originalUpdatedAt = deletedItem?.updatedAt
      ? new Date(deletedItem.updatedAt).getTime()
      : 0;

    // Wait a bit to ensure time difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ACT - Restore it
    const response = await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT
    expect(response.status).toBe(200);
    const restoredUpdatedAt = new Date(
      response.body.restoredItem.updatedAt,
    ).getTime();
    expect(restoredUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('restored item appears in GET /menu', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Mocha',
      price: 5.0,
      description: 'Espresso with chocolate',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // Verify it's not in GET /menu
    const beforeRestore = await request(app).get('/menu');
    const itemIdsBefore = beforeRestore.body.map(
      (i: { id: number }) => i.id,
    );
    expect(itemIdsBefore).not.toContain(item.id);

    // ACT - Restore it
    await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT - Query GET /menu
    const afterRestore = await request(app).get('/menu');
    expect(afterRestore.status).toBe(200);
    const itemIdsAfter = afterRestore.body.map((i: { id: number }) => i.id);
    expect(itemIdsAfter).toContain(item.id);

    // Verify the restored item has correct data
    const restoredItemInList = afterRestore.body.find(
      (i: { id: number }) => i.id === item.id,
    );
    expect(restoredItemInList).toBeDefined();
    expect(restoredItemInList.name).toBe('Mocha');
    expect(restoredItemInList.deletedAt).toBeNull();
  });

  it('restored item appears in GET /menu/:id', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Americano',
      price: 3.0,
      description: 'Espresso with hot water',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // Verify it's not accessible via GET /menu/:id
    const beforeRestore = await request(app).get(`/menu/${item.id}`);
    expect(beforeRestore.status).toBe(404);

    // ACT - Restore it
    await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT - Query GET /menu/:id
    const afterRestore = await request(app).get(`/menu/${item.id}`);
    expect(afterRestore.status).toBe(200);
    expect(afterRestore.body.id).toBe(item.id);
    expect(afterRestore.body.name).toBe('Americano');
    expect(afterRestore.body.deletedAt).toBeNull();
  });

  it('returns 200 with restored item', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Macchiato',
      price: 3.5,
      description: 'Espresso with a dollop of foam',
    });

    // Soft delete it
    await request(app).delete(`/menu/${item.id}`);

    // ACT - Restore it
    const response = await request(app).post(`/menu/${item.id}/restore`);

    // ASSERT - Verify response contains all required fields
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('restoredItem');
    expect(response.body.restoredItem).toHaveProperty('id');
    expect(response.body.restoredItem).toHaveProperty('name');
    expect(response.body.restoredItem).toHaveProperty('price');
    expect(response.body.restoredItem).toHaveProperty('description');
    expect(response.body.restoredItem).toHaveProperty('createdAt');
    expect(response.body.restoredItem).toHaveProperty('updatedAt');
    expect(response.body.restoredItem).toHaveProperty('deletedAt');

    // Verify deletedAt is null
    expect(response.body.restoredItem.deletedAt).toBeNull();

    // Verify item can be queried by name (case-insensitive)
    const nameQuery = await request(app).get(
      `/menu/name/${response.body.restoredItem.name.toLowerCase()}`,
    );
    expect(nameQuery.status).toBe(200);
    expect(nameQuery.body.id).toBe(item.id);
  });
});

