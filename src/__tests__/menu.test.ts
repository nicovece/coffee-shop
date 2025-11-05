import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestMenuItem, createTestMenuItems } from './helpers';
import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('GET /menu', () => {
  it('returns an empty array when no items exist', async () => {
    // ACT
    const response = await request(app).get('/menu');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns all menu items', async () => {
    // ARRANGE
    await createTestMenuItems(3);

    // ACT
    const response = await request(app).get('/menu');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('price');
    expect(response.body[0]).toHaveProperty('description');
  });

  it('excludes soft-deleted items from results', async () => {
    // ARRANGE
    const items = await createTestMenuItems(3);
    const { testDb } = await import('./setup');
    const { menuItems } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Soft delete the middle item
    testDb
      .update(menuItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(menuItems.id, items[1].id))
      .run();

    // ACT
    const response = await request(app).get('/menu');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((item: { id: number }) => item.id)).not.toContain(
      items[1].id
    );
  });

  it('returns items with all required fields', async () => {
    // ARRANGE
    await createTestMenuItems(1);

    // ACT
    const response = await request(app).get('/menu');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('price');
    expect(response.body[0]).toHaveProperty('description');
    expect(response.body[0]).toHaveProperty('createdAt');
    expect(response.body[0]).toHaveProperty('updatedAt');
    expect(response.body[0]).toHaveProperty('deletedAt');
  });
});

describe('GET /menu/:id', () => {
  it('returns a specific menu item by id', async () => {
    // ARRANGE
    const created = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'Strong coffee',
    });

    // ACT
    const response = await request(app).get(`/menu/${created.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Espresso');
    expect(response.body.price).toBe(2.5);
  });

  it('returns 404 for non-existent item', async () => {
    // ACT
    const response = await request(app).get('/menu/999');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('returns 400 for invalid id', async () => {
    // ACT
    const response = await request(app).get('/menu/abc');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 404 for soft-deleted item', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'Strong coffee',
    });
    const { testDb } = await import('./setup');
    const { menuItems } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Soft delete it
    testDb
      .update(menuItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(menuItems.id, item.id))
      .run();

    // ACT
    const response = await request(app).get(`/menu/${item.id}`);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 400 for negative id', async () => {
    // ACT
    const response = await request(app).get('/menu/-1');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 404 for zero id (valid format but no item exists)', async () => {
    // ACT - Zero is a valid integer format, so validation passes but item doesn't exist
    const response = await request(app).get('/menu/0');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 400 for non-integer id', async () => {
    // ACT
    const response = await request(app).get('/menu/1.5');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});
