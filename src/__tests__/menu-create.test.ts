import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestMenuItem } from './helpers';
import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('POST /menu - Success Cases', () => {
  it('creates menu item with valid data', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Espresso');
    expect(response.body.price).toBe(2.5);
    expect(response.body.description).toBe('A strong and bold coffee');
  });

  it('returns 201 status code', async () => {
    // ARRANGE
    const newItem = {
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
  });

  it('returns created item with auto-generated id', async () => {
    // ARRANGE
    const newItem = {
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(typeof response.body.id).toBe('number');
    expect(response.body.id).toBeGreaterThan(0);
  });

  it('returns created item with timestamps (createdAt, updatedAt)', async () => {
    // ARRANGE
    const newItem = {
      name: 'Americano',
      price: 3.0,
      description: 'Espresso with hot water',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
    // Verify timestamps are valid date strings (Express JSON.stringify converts Date to ISO strings)
    expect(typeof response.body.createdAt).toBe('string');
    expect(typeof response.body.updatedAt).toBe('string');
    expect(new Date(response.body.createdAt).getTime()).toBeGreaterThan(0);
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(0);
  });
});

describe('POST /menu - Missing Required Fields', () => {
  it('returns 400 for missing name', async () => {
    // ARRANGE
    const newItem = {
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    expect(response.body.details).toBeInstanceOf(Array);
    expect(response.body.details.length).toBeGreaterThan(0);
    const nameError = response.body.details.find(
      (err: { field: string }) => err.field === 'name'
    );
    expect(nameError).toBeDefined();
  });

  it('returns 400 for missing price', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    expect(response.body.details).toBeInstanceOf(Array);
    expect(response.body.details.length).toBeGreaterThan(0);
    const priceError = response.body.details.find(
      (err: { field: string }) => err.field === 'price'
    );
    expect(priceError).toBeDefined();
  });

  it('returns 400 for missing description', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    expect(response.body.details).toBeInstanceOf(Array);
    expect(response.body.details.length).toBeGreaterThan(0);
    const descriptionError = response.body.details.find(
      (err: { field: string }) => err.field === 'description'
    );
    expect(descriptionError).toBeDefined();
  });
});

describe('POST /menu - Name Validation', () => {
  it('returns 400 for name too short (< 2 chars)', async () => {
    // ARRANGE
    const newItem = {
      name: 'A', // Only 1 character
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const nameError = response.body.details.find(
      (err: { field: string }) => err.field === 'name'
    );
    expect(nameError).toBeDefined();
    expect(nameError.message).toContain('at least 2 characters');
  });

  it('returns 400 for name too long (> 100 chars)', async () => {
    // ARRANGE
    const longName = 'A'.repeat(101); // 101 characters
    const newItem = {
      name: longName,
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const nameError = response.body.details.find(
      (err: { field: string }) => err.field === 'name'
    );
    expect(nameError).toBeDefined();
    expect(nameError.message).toContain('at most 100 characters');
  });

  it('trims whitespace from name', async () => {
    // ARRANGE
    const newItem = {
      name: '  Espresso  ', // With leading and trailing whitespace
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Espresso'); // Should be trimmed
    expect(response.body.name).not.toBe('  Espresso  ');
  });

  it('returns 400 for empty string after trimming name', async () => {
    // ARRANGE
    const newItem = {
      name: '   ', // Only whitespace
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const nameError = response.body.details.find(
      (err: { field: string }) => err.field === 'name'
    );
    expect(nameError).toBeDefined();
    expect(nameError.message).toContain('empty after trimming');
  });
});

describe('POST /menu - Description Validation', () => {
  it('returns 400 for description too short (< 10 chars)', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: 'Short', // Only 5 characters
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const descriptionError = response.body.details.find(
      (err: { field: string }) => err.field === 'description'
    );
    expect(descriptionError).toBeDefined();
    expect(descriptionError.message).toContain('at least 10 characters');
  });

  it('returns 400 for description too long (> 500 chars)', async () => {
    // ARRANGE
    const longDescription = 'A'.repeat(501); // 501 characters
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: longDescription,
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const descriptionError = response.body.details.find(
      (err: { field: string }) => err.field === 'description'
    );
    expect(descriptionError).toBeDefined();
    expect(descriptionError.message).toContain('at most 500 characters');
  });

  it('trims whitespace from description', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: '  A strong and bold coffee  ', // With leading and trailing whitespace
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.description).toBe('A strong and bold coffee'); // Should be trimmed
    expect(response.body.description).not.toBe('  A strong and bold coffee  ');
  });

  it('returns 400 for empty string after trimming description', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: '          ', // Only whitespace
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const descriptionError = response.body.details.find(
      (err: { field: string }) => err.field === 'description'
    );
    expect(descriptionError).toBeDefined();
    expect(descriptionError.message).toContain('empty after trimming');
  });
});

describe('POST /menu - Price Validation', () => {
  it('returns 400 for negative price', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: -5.0,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const priceError = response.body.details.find(
      (err: { field: string }) => err.field === 'price'
    );
    expect(priceError).toBeDefined();
    expect(priceError.message).toContain('positive');
  });

  it('returns 400 for zero price', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 0,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const priceError = response.body.details.find(
      (err: { field: string }) => err.field === 'price'
    );
    expect(priceError).toBeDefined();
    expect(priceError.message).toContain('positive');
  });

  it('returns 400 for price > 999.99', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 1000.0,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const priceError = response.body.details.find(
      (err: { field: string }) => err.field === 'price'
    );
    expect(priceError).toBeDefined();
    expect(priceError.message).toContain('999.99');
  });

  it('returns 400 for non-numeric price', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 'not-a-number' as any, // Sending string instead of number
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    const priceError = response.body.details.find(
      (err: { field: string }) => err.field === 'price'
    );
    expect(priceError).toBeDefined();
  });
});

describe('POST /menu - Business Logic', () => {
  it('returns 409 when duplicate name exists (case-insensitive)', async () => {
    // ARRANGE - Create an item first
    await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT - Try to create another item with same name (different case)
    const newItem = {
      name: 'ESPRESSO', // Different case
      price: 3.0,
      description: 'Another espresso description',
    };
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Coffee with this name already exists');
  });

  it('prevents duplicate names (case-insensitive check)', async () => {
    // ARRANGE - Create an item first
    await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    // ACT - Try to create another item with same name (mixed case)
    const newItem = {
      name: 'cApPuCcInO', // Mixed case
      price: 4.0,
      description: 'Another cappuccino description',
    };
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Coffee with this name already exists');

    // Verify only one item exists with that name
    const allItems = await request(app).get('/menu');
    const cappuccinoItems = allItems.body.filter(
      (item: { name: string }) => item.name.toLowerCase() === 'cappuccino'
    );
    expect(cappuccinoItems.length).toBe(1);
  });

  it('returns 409 for duplicate name even if one is soft-deleted', async () => {
    // ARRANGE - Create and soft-delete an item
    const existingItem = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // Soft delete it
    testDb
      .update(menuItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(menuItems.id, existingItem.id))
      .run();

    // Verify the item is soft-deleted
    const deletedItem = testDb
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, existingItem.id))
      .get();
    expect(deletedItem?.deletedAt).toBeDefined();

    // ACT - Try to create another item with same name
    const newItem = {
      name: 'Latte', // Same name as soft-deleted item
      price: 4.5,
      description: 'Another latte description',
    };
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT - According to test plan, should return 409 even if one is soft-deleted
    // Note: This tests the actual behavior - the endpoint uses notDeleted filter
    // which should exclude soft-deleted items, but if it returns 409, that's the current behavior
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Coffee with this name already exists');
  });

  it('auto-generates unique id', async () => {
    // ARRANGE - Create multiple items
    const item1 = {
      name: 'Coffee One',
      price: 2.5,
      description: 'First coffee item',
    };
    const item2 = {
      name: 'Coffee Two',
      price: 3.0,
      description: 'Second coffee item',
    };
    const item3 = {
      name: 'Coffee Three',
      price: 3.5,
      description: 'Third coffee item',
    };

    // ACT
    const response1 = await request(app).post('/menu').send(item1);
    const response2 = await request(app).post('/menu').send(item2);
    const response3 = await request(app).post('/menu').send(item3);

    // ASSERT
    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
    expect(response3.status).toBe(201);

    // Verify all IDs are unique and sequential
    const id1 = response1.body.id;
    const id2 = response2.body.id;
    const id3 = response3.body.id;

    expect(id1).toBeGreaterThan(0);
    expect(id2).toBeGreaterThan(id1);
    expect(id3).toBeGreaterThan(id2);
    expect(new Set([id1, id2, id3]).size).toBe(3); // All unique
  });

  it('sets createdAt and updatedAt timestamps', async () => {
    // ARRANGE
    const newItem = {
      name: 'Mocha',
      price: 4.5,
      description: 'Espresso with chocolate and milk',
    };

    // ACT
    const beforeTime = Date.now();
    const response = await request(app).post('/menu').send(newItem);
    const afterTime = Date.now();

    // ASSERT
    expect(response.status).toBe(201);
    const createdAt = new Date(response.body.createdAt).getTime();
    const updatedAt = new Date(response.body.updatedAt).getTime();

    // Timestamps should be within the test execution window (allow 1 second margin for clock differences)
    expect(createdAt).toBeGreaterThanOrEqual(beforeTime - 1000);
    expect(createdAt).toBeLessThanOrEqual(afterTime + 1000);
    expect(updatedAt).toBeGreaterThanOrEqual(beforeTime - 1000);
    expect(updatedAt).toBeLessThanOrEqual(afterTime + 1000);

    // createdAt and updatedAt should be the same on creation
    expect(createdAt).toBe(updatedAt);
  });
});
