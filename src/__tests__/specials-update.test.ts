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

describe('PATCH /special/:id - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ARRANGE
    const updateData = {
      name: 'Updated Name',
    };

    // ACT
    const response = await request(app).patch('/special/abc').send(updateData);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent special', async () => {
    // ARRANGE
    const updateData = {
      name: 'Updated Name',
    };

    // ACT
    const response = await request(app).patch('/special/999').send(updateData);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Special not found');
  });

  it('returns 400 for negative id', async () => {
    // ARRANGE
    const updateData = {
      name: 'Updated Name',
    };

    // ACT
    const response = await request(app).patch('/special/-1').send(updateData);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('PATCH /special/:id - Body Validation', () => {
  it('returns 400 when no fields are provided', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({});

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 when name is too short', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ name: 'A' }); // Too short (min 2 characters)

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 when name is too long', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ name: 'A'.repeat(101) }); // Too long (max 100 characters)

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 when price is negative', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ price: -5.99 });

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 when price exceeds maximum', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ price: 1000.0 }); // Exceeds max $999.99

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 when description is too short', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ description: 'Short' }); // Too short (min 10 characters)

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 when valid_from is after valid_to', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        valid_from: '2024-12-31T00:00:00Z',
        valid_to: '2024-01-01T00:00:00Z', // After valid_from (invalid)
      });

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 when valid_from is invalid ISO date', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        valid_from: 'not-a-date',
      });

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('PATCH /special/:id - Success Cases - Partial Updates', () => {
  it('updates name only', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Original Name',
      price: 5.99,
      description: 'Original description for testing',
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ name: 'Updated Name' });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');
    expect(response.body.price).toBe(5.99); // Unchanged
    expect(response.body.description).toBe('Original description for testing'); // Unchanged
  });

  it('updates price only', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Test Special',
      price: 5.99,
      description: 'Original description for testing',
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ price: 7.99 });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.price).toBe(7.99);
    expect(response.body.name).toBe('Test Special'); // Unchanged
    expect(response.body.description).toBe('Original description for testing'); // Unchanged
  });

  it('updates description only', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Test Special',
      price: 5.99,
      description: 'Original description',
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({ description: 'Updated description with more details' });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.description).toBe(
      'Updated description with more details'
    );
    expect(response.body.name).toBe('Test Special'); // Unchanged
    expect(response.body.price).toBe(5.99); // Unchanged
  });

  it('updates multiple fields at once', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Original Name',
      price: 5.99,
      description: 'Original description',
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        name: 'Updated Name',
        price: 8.99,
        description: 'Updated description with more details',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');
    expect(response.body.price).toBe(8.99);
    expect(response.body.description).toBe(
      'Updated description with more details'
    );
  });

  it('trims whitespace from name and description', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        name: '  Trimmed Name  ',
        description: '  Trimmed description with spaces  ',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Trimmed Name');
    expect(response.body.description).toBe('Trimmed description with spaces');
  });
});

describe('PATCH /special/:id - is_active Mutually Exclusive Logic', () => {
  it('deactivates other specials when activating a special', async () => {
    // ARRANGE - Create two specials, one active, one inactive
    const activeSpecial = createTestSpecial({
      name: 'Currently Active',
      is_active: true,
    });
    const inactiveSpecial = createTestSpecial({
      name: 'Inactive Special',
      is_active: false,
    });

    // Verify initial state
    expect(activeSpecial.is_active).toBe(true);
    expect(inactiveSpecial.is_active).toBe(false);

    // ACT - Activate the inactive special
    const response = await request(app)
      .patch(`/special/${inactiveSpecial.id}`)
      .send({ is_active: true });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.is_active).toBe(true);

    // Verify the previously active special is now inactive
    const updatedActiveSpecial = testDb
      .select()
      .from(special)
      .where(eq(special.id, activeSpecial.id))
      .get();
    expect(updatedActiveSpecial?.is_active).toBe(false);
  });

  it('does not deactivate others when setting is_active to false', async () => {
    // ARRANGE - Create two active specials (shouldn't happen normally, but test the logic)
    const special1 = createTestSpecial({
      name: 'Special 1',
      is_active: true,
    });
    const special2 = createTestSpecial({
      name: 'Special 2',
      is_active: true,
    });

    // ACT - Deactivate special1
    const response = await request(app)
      .patch(`/special/${special1.id}`)
      .send({ is_active: false });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.is_active).toBe(false);

    // Verify special2 is still active (shouldn't be deactivated)
    const updatedSpecial2 = testDb
      .select()
      .from(special)
      .where(eq(special.id, special2.id))
      .get();
    expect(updatedSpecial2?.is_active).toBe(true);
  });

  it('handles activating a special when multiple are active', async () => {
    // ARRANGE - Create multiple active specials (edge case)
    const special1 = createTestSpecial({ name: 'Special 1', is_active: true });
    const special2 = createTestSpecial({ name: 'Special 2', is_active: true });
    const special3 = createTestSpecial({ name: 'Special 3', is_active: true });
    const targetSpecial = createTestSpecial({
      name: 'Target Special',
      is_active: false,
    });

    // ACT - Activate target special
    const response = await request(app)
      .patch(`/special/${targetSpecial.id}`)
      .send({ is_active: true });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.is_active).toBe(true);

    // Verify all other specials are now inactive
    const updated1 = testDb
      .select()
      .from(special)
      .where(eq(special.id, special1.id))
      .get();
    const updated2 = testDb
      .select()
      .from(special)
      .where(eq(special.id, special2.id))
      .get();
    const updated3 = testDb
      .select()
      .from(special)
      .where(eq(special.id, special3.id))
      .get();

    expect(updated1?.is_active).toBe(false);
    expect(updated2?.is_active).toBe(false);
    expect(updated3?.is_active).toBe(false);
  });

  it('does not affect other specials when updating non-is_active fields', async () => {
    // ARRANGE
    const activeSpecial = createTestSpecial({
      name: 'Active Special',
      is_active: true,
    });
    const otherSpecial = createTestSpecial({
      name: 'Other Special',
      is_active: true,
    });

    // ACT - Update only the name
    const response = await request(app)
      .patch(`/special/${activeSpecial.id}`)
      .send({ name: 'Updated Name' });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');

    // Verify other special is still active
    const updatedOther = testDb
      .select()
      .from(special)
      .where(eq(special.id, otherSpecial.id))
      .get();
    expect(updatedOther?.is_active).toBe(true);
  });
});

describe('PATCH /special/:id - Date Handling', () => {
  it('sets valid_from and valid_to dates', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Test Special',
      valid_from: null,
      valid_to: null,
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2024-12-31T23:59:59Z',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('valid_from');
    expect(response.body).toHaveProperty('valid_to');
    expect(response.body.valid_from).not.toBeNull();
    expect(response.body.valid_to).not.toBeNull();
  });

  it('clears dates when set to null', async () => {
    // ARRANGE - Create special with dates
    const validFrom = new Date('2024-01-01T00:00:00Z');
    const validTo = new Date('2024-12-31T23:59:59Z');
    const specialItem = createTestSpecial({
      name: 'Test Special',
      valid_from: validFrom,
      valid_to: validTo,
    });

    // ACT - Clear the dates
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        valid_from: null,
        valid_to: null,
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.valid_from).toBeNull();
    expect(response.body.valid_to).toBeNull();
  });

  it('updates only valid_from', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Test Special',
      valid_from: null,
      valid_to: null,
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        valid_from: '2024-01-01T00:00:00Z',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.valid_from).not.toBeNull();
    expect(response.body.valid_to).toBeNull(); // Should remain unchanged
  });

  it('updates only valid_to', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Test Special',
      valid_from: null,
      valid_to: null,
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        valid_to: '2024-12-31T23:59:59Z',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.valid_from).toBeNull(); // Should remain unchanged
    expect(response.body.valid_to).not.toBeNull();
  });

  it('leaves dates unchanged when not provided', async () => {
    // ARRANGE - Create special with dates
    const validFrom = new Date('2024-01-01T00:00:00Z');
    const validTo = new Date('2024-12-31T23:59:59Z');
    const specialItem = createTestSpecial({
      name: 'Test Special',
      valid_from: validFrom,
      valid_to: validTo,
    });

    // ACT - Update only name (don't touch dates)
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        name: 'Updated Name',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Name');
    expect(response.body.valid_from).not.toBeNull(); // Should remain unchanged
    expect(response.body.valid_to).not.toBeNull(); // Should remain unchanged
  });
});

describe('PATCH /special/:id - Edge Cases', () => {
  it('updates all fields at once', async () => {
    // ARRANGE
    const specialItem = createTestSpecial({
      name: 'Original Name',
      price: 5.99,
      description: 'Original description',
      is_active: false,
      valid_from: null,
      valid_to: null,
    });

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        name: 'New Name',
        price: 9.99,
        description: 'New description with more details',
        is_active: true,
        valid_from: '2024-01-01T00:00:00Z',
        valid_to: '2024-12-31T23:59:59Z',
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('New Name');
    expect(response.body.price).toBe(9.99);
    expect(response.body.description).toBe('New description with more details');
    expect(response.body.is_active).toBe(true);
    expect(response.body.valid_from).not.toBeNull();
    expect(response.body.valid_to).not.toBeNull();
  });

  it('returns updated special with all fields', async () => {
    // ARRANGE
    const specialItem = createTestSpecial();

    // ACT
    const response = await request(app)
      .patch(`/special/${specialItem.id}`)
      .send({
        name: 'Updated Special',
        price: 6.99,
      });

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('price');
    expect(response.body).toHaveProperty('description');
    expect(response.body).toHaveProperty('is_active');
    expect(response.body).toHaveProperty('valid_from');
    expect(response.body).toHaveProperty('valid_to');
  });
});
