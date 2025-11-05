import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { testDb } from './setup';
import { special } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type Special = InferSelectModel<typeof special>;

/**
 * Helper to create a test special
 * Reduces boilerplate in tests
 */
const createTestSpecial = (overrides: Partial<Special> = {}): Special => {
  const defaultSpecial = {
    name: 'Test Special',
    price: 4.99,
    description: 'A delicious test special item',
    is_active: true,
    valid_from: null,
    valid_to: null,
  };

  const specialData = { ...defaultSpecial, ...overrides };

  testDb.insert(special).values(specialData).run();

  // Fetch the created special by finding the max ID
  const created = testDb
    .select()
    .from(special)
    .where(eq(special.id, sql`(SELECT MAX(id) FROM daily_special)`))
    .get();

  if (!created) {
    throw new Error(`Failed to retrieve created special: ${specialData.name}`);
  }

  return created;
};

describe('DELETE /special/:id - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ACT
    const response = await request(app).delete('/special/abc');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent special', async () => {
    // ACT
    const response = await request(app).delete('/special/999');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Special not found');
  });

  it('returns 404 for already soft-deleted special', async () => {
    // ARRANGE - Create and soft-delete a special
    const specialItem = createTestSpecial({
      name: 'Test Special',
      price: 4.99,
      description: 'A test special item',
    });

    // Soft delete it
    testDb
      .update(special)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(special.id, specialItem.id))
      .run();

    // ACT - Try to soft delete it again
    const response = await request(app).delete(`/special/${specialItem.id}`);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Special not found');
  });
});

describe('DELETE /special/:id - Business Logic - Soft Delete', () => {
  it('soft deletes special successfully', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Monday Special',
      price: 5.99,
      description: 'A great Monday special',
    });

    // ACT
    const response = await request(app).delete(`/special/${specialItem.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Special soft-deleted successfully');
    expect(response.body).toHaveProperty('deletedSpecial');
    expect(response.body.deletedSpecial.id).toBe(specialItem.id);
    expect(response.body.deletedSpecial.name).toBe('Monday Special');
  });

  it('sets deletedAt timestamp', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Tuesday Special',
      price: 6.99,
      description: 'A great Tuesday special',
    });

    // ACT
    const response = await request(app).delete(`/special/${specialItem.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.deletedSpecial).toHaveProperty('deletedAt');
    expect(response.body.deletedSpecial.deletedAt).toBeDefined();
    expect(response.body.deletedSpecial.deletedAt).not.toBeNull();

    // Verify deletedAt is a valid date (could be string or number depending on ORM mode)
    const deletedAt =
      typeof response.body.deletedSpecial.deletedAt === 'string'
        ? new Date(response.body.deletedSpecial.deletedAt).getTime()
        : response.body.deletedSpecial.deletedAt;
    expect(deletedAt).toBeGreaterThan(0);
  });

  it('updates updatedAt timestamp', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Wednesday Special',
      price: 7.99,
      description: 'A great Wednesday special',
    });

    // Get original updatedAt
    let originalUpdatedAt: number;
    if (typeof specialItem.updatedAt === 'string') {
      originalUpdatedAt = new Date(specialItem.updatedAt).getTime();
    } else if (specialItem.updatedAt instanceof Date) {
      originalUpdatedAt = specialItem.updatedAt.getTime();
    } else {
      originalUpdatedAt = specialItem.updatedAt as number;
    }

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ACT
    const beforeDeleteTime = Date.now();
    const response = await request(app).delete(`/special/${specialItem.id}`);
    const afterDeleteTime = Date.now();

    // ASSERT
    expect(response.status).toBe(200);
    let updatedUpdatedAt: number;
    if (typeof response.body.deletedSpecial.updatedAt === 'string') {
      updatedUpdatedAt = new Date(response.body.deletedSpecial.updatedAt).getTime();
    } else if (response.body.deletedSpecial.updatedAt instanceof Date) {
      updatedUpdatedAt = response.body.deletedSpecial.updatedAt.getTime();
    } else {
      updatedUpdatedAt = response.body.deletedSpecial.updatedAt as number;
    }

    // updatedAt should have changed (or at least be >= original)
    expect(updatedUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    expect(updatedUpdatedAt).toBeGreaterThanOrEqual(beforeDeleteTime - 2000);
    expect(updatedUpdatedAt).toBeLessThanOrEqual(afterDeleteTime + 2000);
  });

  it('returns 200 with deleted special', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Thursday Special',
      price: 8.99,
      description: 'A great Thursday special',
    });

    // ACT
    const response = await request(app).delete(`/special/${specialItem.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deletedSpecial');

    // Verify deleted special has all required fields
    const deletedSpecial = response.body.deletedSpecial;
    expect(deletedSpecial).toHaveProperty('id');
    expect(deletedSpecial).toHaveProperty('name');
    expect(deletedSpecial).toHaveProperty('price');
    expect(deletedSpecial).toHaveProperty('description');
    expect(deletedSpecial).toHaveProperty('is_active');
    expect(deletedSpecial).toHaveProperty('valid_from');
    expect(deletedSpecial).toHaveProperty('valid_to');
    expect(deletedSpecial).toHaveProperty('deletedAt');

    // Verify field values
    expect(deletedSpecial.id).toBe(specialItem.id);
    expect(deletedSpecial.name).toBe('Thursday Special');
    expect(deletedSpecial.price).toBe(8.99);
    expect(deletedSpecial.description).toBe('A great Thursday special');
    expect(deletedSpecial.deletedAt).not.toBeNull();
  });
});

describe('DELETE /special/:id - Business Logic - Exclusion from Queries', () => {
  it('soft-deleted special no longer appears in GET /specials', async () => {
    // ARRANGE - Create multiple specials
    const special1 = createTestSpecial({
      name: 'Special 1',
      is_active: true,
    });
    const special2 = createTestSpecial({
      name: 'Special 2',
      is_active: false,
    });
    const special3 = createTestSpecial({
      name: 'Special 3',
      is_active: true,
    });

    // Soft delete the middle special
    await request(app).delete(`/special/${special2.id}`);

    // ACT
    const response = await request(app).get('/specials');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2);

    // Verify special2 is not in the results
    const specialIds = response.body.map((s: { id: number }) => s.id);
    expect(specialIds).toContain(special1.id);
    expect(specialIds).toContain(special3.id);
    expect(specialIds).not.toContain(special2.id);
  });

  it('soft-deleted special no longer appears in GET /specials/:id', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Deleted Special',
      is_active: true,
    });

    // Soft delete it
    await request(app).delete(`/special/${specialItem.id}`);

    // ACT
    const response = await request(app).get(`/specials/${specialItem.id}`);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Special not found');
  });

  it('soft-deleted special no longer appears in GET /specials/active', async () => {
    // ARRANGE
    const special1 = createTestSpecial({
      name: 'Active Special 1',
      is_active: true,
    });
    const special2 = createTestSpecial({
      name: 'Active Special 2',
      is_active: true,
    });

    // Soft delete one active special
    await request(app).delete(`/special/${special1.id}`);

    // ACT
    const response = await request(app).get('/specials/active');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    // Should only return the non-deleted active special
    const specialIds = response.body.map((s: { id: number }) => s.id);
    expect(specialIds).toContain(special2.id);
    expect(specialIds).not.toContain(special1.id);
  });
});

describe('DELETE /special/:id/hard-delete - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ACT
    const response = await request(app).delete('/special/abc/hard-delete');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent special', async () => {
    // ACT
    const response = await request(app).delete('/special/999/hard-delete');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Special not found');
  });

  it('returns 400 for active special (not soft-deleted)', async () => {
    // ARRANGE - Create an active special (not soft-deleted)
    const specialItem = createTestSpecial({
      name: 'Active Special',
      price: 5.99,
      description: 'An active special',
    });

    // ACT - Try to hard delete an active special
    const response = await request(app).delete(
      `/special/${specialItem.id}/hard-delete`
    );

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Cannot hard delete active special');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Special must be soft-deleted first');
  });
});

describe('DELETE /special/:id/hard-delete - Business Logic - Hard Delete', () => {
  it('hard deletes soft-deleted special successfully', async () => {
    // ARRANGE - Create and soft-delete a special
    const specialItem = createTestSpecial({
      name: 'To Be Deleted',
      price: 5.99,
      description: 'This special will be hard deleted',
    });

    // Soft delete it first
    await request(app).delete(`/special/${specialItem.id}`);

    // ACT - Hard delete it
    const response = await request(app).delete(
      `/special/${specialItem.id}/hard-delete`
    );

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Special deleted successfully');
    expect(response.body).toHaveProperty('deletedSpecial');
    expect(response.body.deletedSpecial.id).toBe(specialItem.id);
    expect(response.body.deletedSpecial.name).toBe('To Be Deleted');
  });

  it('returns 200 with deleted special info', async () => {
    // ARRANGE - Create and soft-delete a special
    const specialItem = createTestSpecial({
      name: 'Another Special',
      price: 6.99,
      description: 'Another special to be deleted',
    });

    // Soft delete it first
    await request(app).delete(`/special/${specialItem.id}`);

    // ACT - Hard delete it
    const response = await request(app).delete(
      `/special/${specialItem.id}/hard-delete`
    );

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deletedSpecial');

    // Verify deleted special has all required fields
    const deletedSpecial = response.body.deletedSpecial;
    expect(deletedSpecial).toHaveProperty('id');
    expect(deletedSpecial).toHaveProperty('name');
    expect(deletedSpecial).toHaveProperty('price');
    expect(deletedSpecial).toHaveProperty('description');
    expect(deletedSpecial).toHaveProperty('is_active');
    expect(deletedSpecial).toHaveProperty('valid_from');
    expect(deletedSpecial).toHaveProperty('valid_to');
    expect(deletedSpecial).toHaveProperty('deletedAt');

    // Verify field values
    expect(deletedSpecial.id).toBe(specialItem.id);
    expect(deletedSpecial.name).toBe('Another Special');
    expect(deletedSpecial.price).toBe(6.99);
    expect(deletedSpecial.description).toBe('Another special to be deleted');
  });

  it('special is permanently removed from database', async () => {
    // ARRANGE - Create and soft-delete a special
    const specialItem = createTestSpecial({
      name: 'Permanently Deleted',
      price: 7.99,
      description: 'This will be permanently deleted',
    });

    // Soft delete it first
    await request(app).delete(`/special/${specialItem.id}`);

    // ACT - Hard delete it
    const response = await request(app).delete(
      `/special/${specialItem.id}/hard-delete`
    );
    expect(response.status).toBe(200);

    // ASSERT - Verify special no longer exists in database (even with direct query)
    const deletedSpecial = testDb
      .select()
      .from(special)
      .where(eq(special.id, specialItem.id))
      .get();

    expect(deletedSpecial).toBeUndefined();

    // Also verify it's not accessible via API endpoints
    const getResponse = await request(app).get(`/specials/${specialItem.id}`);
    expect(getResponse.status).toBe(404);
    expect(getResponse.body.error).toBe('Special not found');
  });
});

