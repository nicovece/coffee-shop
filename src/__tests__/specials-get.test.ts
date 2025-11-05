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

describe('GET /specials', () => {
  it('returns an empty array when no specials exist', async () => {
    // ACT
    const response = await request(app).get('/specials');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns all specials (active and inactive)', async () => {
    // ARRANGE - Create multiple specials with different statuses
    const activeSpecial = createTestSpecial({
      name: 'Active Special',
      is_active: true,
    });
    const inactiveSpecial = createTestSpecial({
      name: 'Inactive Special',
      is_active: false,
    });
    const anotherActiveSpecial = createTestSpecial({
      name: 'Another Active Special',
      is_active: true,
    });

    // ACT
    const response = await request(app).get('/specials');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: activeSpecial.id,
          name: 'Active Special',
        }),
        expect.objectContaining({
          id: inactiveSpecial.id,
          name: 'Inactive Special',
        }),
        expect.objectContaining({
          id: anotherActiveSpecial.id,
          name: 'Another Active Special',
        }),
      ])
    );
  });

  it('returns specials with all required fields', async () => {
    // ARRANGE
    createTestSpecial();

    // ACT
    const response = await request(app).get('/specials');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('price');
    expect(response.body[0]).toHaveProperty('description');
    expect(response.body[0]).toHaveProperty('is_active');
    expect(response.body[0]).toHaveProperty('valid_from');
    expect(response.body[0]).toHaveProperty('valid_to');
  });

  it('returns specials with date fields', async () => {
    // ARRANGE - Create special with dates
    const validFrom = new Date('2024-01-01T00:00:00Z');
    const validTo = new Date('2024-12-31T23:59:59Z');
    createTestSpecial({
      name: 'Dated Special',
      valid_from: validFrom,
      valid_to: validTo,
    });

    // ACT
    const response = await request(app).get('/specials');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body[0]).toHaveProperty('valid_from');
    expect(response.body[0]).toHaveProperty('valid_to');
    // Dates can be returned as numbers (timestamps) or strings depending on ORM mode
    // The important thing is that they exist and are not null
    expect(response.body[0].valid_from).not.toBeNull();
    expect(response.body[0].valid_to).not.toBeNull();
  });
});

describe('GET /specials/active', () => {
  it('returns an empty array when no active specials exist', async () => {
    // ARRANGE - Create only inactive specials
    createTestSpecial({ name: 'Inactive 1', is_active: false });
    createTestSpecial({ name: 'Inactive 2', is_active: false });

    // ACT
    const response = await request(app).get('/specials/active');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns only active specials', async () => {
    // ARRANGE - Create mix of active and inactive specials
    const activeSpecial1 = createTestSpecial({
      name: 'Active Special 1',
      is_active: true,
    });
    const inactiveSpecial = createTestSpecial({
      name: 'Inactive Special',
      is_active: false,
    });
    const activeSpecial2 = createTestSpecial({
      name: 'Active Special 2',
      is_active: true,
    });

    // ACT
    const response = await request(app).get('/specials/active');

    // ASSERT
    expect(response.status).toBe(200);
    // Should only return active specials
    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: activeSpecial1.id, is_active: true }),
        expect.objectContaining({ id: activeSpecial2.id, is_active: true }),
      ])
    );
    // Should NOT include inactive special
    expect(response.body.map((s: Special) => s.id)).not.toContain(
      inactiveSpecial.id
    );
  });

  it('returns only one active special when mutually exclusive logic is enforced', async () => {
    // ARRANGE
    // First, create an active special via POST (which enforces mutual exclusivity)
    const firstSpecial = await request(app).post('/special').send({
      name: 'First Active Special',
      price: 5.99,
      description: 'This is the first active special',
      is_active: true,
    });

    // Then create another active special via POST
    // This should deactivate the first one
    const secondSpecial = await request(app).post('/special').send({
      name: 'Second Active Special',
      price: 6.99,
      description: 'This is the second active special',
      is_active: true,
    });

    // ACT
    const response = await request(app).get('/specials/active');

    // ASSERT
    expect(response.status).toBe(200);
    // Should only return one active special (the second one)
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(secondSpecial.body.id);
    expect(response.body[0].is_active).toBe(true);
    expect(response.body[0].name).toBe('Second Active Special');

    // Verify the first special is now inactive
    const allSpecials = await request(app).get('/specials');
    const firstSpecialFromDb = allSpecials.body.find(
      (s: Special) => s.id === firstSpecial.body.id
    );
    expect(firstSpecialFromDb.is_active).toBe(false);
  });

  it('returns specials with all required fields', async () => {
    // ARRANGE
    createTestSpecial({ name: 'Active Test', is_active: true });

    // ACT
    const response = await request(app).get('/specials/active');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
    expect(response.body[0]).toHaveProperty('price');
    expect(response.body[0]).toHaveProperty('description');
    expect(response.body[0]).toHaveProperty('is_active');
    expect(response.body[0].is_active).toBe(true);
  });

  it('filters correctly when multiple specials exist', async () => {
    // ARRANGE - Create 5 specials: 2 active, 3 inactive
    const activeSpecials = [
      createTestSpecial({ name: 'Active 1', is_active: true }),
      createTestSpecial({ name: 'Active 2', is_active: true }),
    ];
    const inactiveSpecials = [
      createTestSpecial({ name: 'Inactive 1', is_active: false }),
      createTestSpecial({ name: 'Inactive 2', is_active: false }),
      createTestSpecial({ name: 'Inactive 3', is_active: false }),
    ];

    // ACT
    const response = await request(app).get('/specials/active');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((s: Special) => s.id)).toEqual(
      expect.arrayContaining(activeSpecials.map((s) => s.id))
    );
    expect(response.body.map((s: Special) => s.id)).not.toEqual(
      expect.arrayContaining(inactiveSpecials.map((s) => s.id))
    );
  });
});

describe('GET /specials/:id', () => {
  it('returns a specific special by id', async () => {
    // ARRANGE - Create a special and get its ID
    const createdSpecial = createTestSpecial({
      name: 'Test Special for ID',
      price: 5.99,
      description: 'A special created for testing ID retrieval',
    });

    // ACT - Request the special by its ID
    const response = await request(app).get(`/specials/${createdSpecial.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(createdSpecial.id);
    expect(response.body.name).toBe('Test Special for ID');
    expect(response.body.price).toBe(5.99);
    expect(response.body.description).toBe(
      'A special created for testing ID retrieval'
    );
  });

  it('returns 404 for non-existent special', async () => {
    // ACT - Request a special that doesn't exist
    const response = await request(app).get('/specials/999');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Special not found');
  });

  it('returns 400 for invalid id format', async () => {
    // ACT - Request with invalid ID (not a number)
    const response = await request(app).get('/specials/abc');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for negative id', async () => {
    // ACT - Request with negative ID
    const response = await request(app).get('/specials/-1');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 404 for zero id (valid format but no special exists)', async () => {
    // ACT - Request with ID 0 (valid format but unlikely to exist)
    const response = await request(app).get('/specials/0');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Special not found');
  });

  it('returns special with all fields including dates', async () => {
    // ARRANGE - Create special with dates
    const validFrom = new Date('2024-01-01T00:00:00Z');
    const validTo = new Date('2024-12-31T23:59:59Z');
    const createdSpecial = createTestSpecial({
      name: 'Dated Special',
      valid_from: validFrom,
      valid_to: validTo,
      is_active: false,
    });

    // ACT
    const response = await request(app).get(`/specials/${createdSpecial.id}`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('price');
    expect(response.body).toHaveProperty('description');
    expect(response.body).toHaveProperty('is_active');
    expect(response.body).toHaveProperty('valid_from');
    expect(response.body).toHaveProperty('valid_to');
    expect(response.body.is_active).toBe(false);
  });

  it('returns special regardless of active status', async () => {
    // ARRANGE - Create both active and inactive specials
    const activeSpecial = createTestSpecial({
      name: 'Active Special',
      is_active: true,
    });
    const inactiveSpecial = createTestSpecial({
      name: 'Inactive Special',
      is_active: false,
    });

    // ACT & ASSERT - Both should be retrievable by ID
    const activeResponse = await request(app).get(
      `/specials/${activeSpecial.id}`
    );
    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.is_active).toBe(true);

    const inactiveResponse = await request(app).get(
      `/specials/${inactiveSpecial.id}`
    );
    expect(inactiveResponse.status).toBe(200);
    expect(inactiveResponse.body.is_active).toBe(false);
  });
});
