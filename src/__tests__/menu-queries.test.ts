import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestMenuItem } from './helpers';
import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('GET /menu/:id/description - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ACT
    const response = await request(app).get('/menu/abc/description');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent item', async () => {
    // ACT
    const response = await request(app).get('/menu/999/description');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 404 for soft-deleted item', async () => {
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

    // ACT - Try to get description for soft-deleted item
    const response = await request(app).get(`/menu/${item.id}/description`);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });
});

describe('GET /menu/:id/description - Business Logic', () => {
  it('returns formatted description with name, description, and price', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT
    const response = await request(app).get(`/menu/${item.id}/description`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('description');
    expect(response.body.description).toContain('Espresso');
    expect(response.body.description).toContain('A strong and bold coffee');
    expect(response.body.description).toContain('2.50');
    expect(response.body.description).toContain('Only $');
    expect(response.body.description).toContain('!');
  });

  it('price is formatted to 2 decimal places', async () => {
    // ARRANGE - Test with price that needs formatting
    const item1 = await createTestMenuItem({
      name: 'Coffee',
      price: 2.5,
      description: 'A simple coffee',
    });

    const item2 = await createTestMenuItem({
      name: 'Latte',
      price: 3.333,
      description: 'A milky coffee',
    });

    // ACT
    const response1 = await request(app).get(`/menu/${item1.id}/description`);
    const response2 = await request(app).get(`/menu/${item2.id}/description`);

    // ASSERT
    expect(response1.status).toBe(200);
    expect(response1.body.description).toContain('2.50');
    expect(response1.body.description).toContain('Only $2.50!');

    expect(response2.status).toBe(200);
    expect(response2.body.description).toContain('3.33');
    expect(response2.body.description).toContain('Only $3.33!');
  });

  it('returns 200 with description object', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    // ACT
    const response = await request(app).get(`/menu/${item.id}/description`);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Object);
    expect(response.body).toHaveProperty('description');
    expect(typeof response.body.description).toBe('string');

    // Verify format: "{name} - {description}. Only ${price}!"
    expect(response.body.description).toBe(
      'Cappuccino - Espresso with steamed milk foam. Only $3.50!'
    );
  });
});

describe('GET /menu/name/:coffeeName - Parameter Validation', () => {
  it('returns 400 for invalid name (too short: < 2 chars)', async () => {
    // ACT
    const response = await request(app).get('/menu/name/A');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for invalid name (too long: > 100 chars)', async () => {
    // ACT
    const longName = 'A'.repeat(101);
    const response = await request(app).get(`/menu/name/${longName}`);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for empty string (after trimming)', async () => {
    // ACT
    const response = await request(app).get('/menu/name/   ');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('trims whitespace from name', async () => {
    // ARRANGE - Create an item
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT - Query with whitespace around the name
    const response = await request(app).get('/menu/name/  Espresso  ');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(item.id);
    expect(response.body.name).toBe('Espresso');
  });
});

describe('GET /menu/name/:coffeeName - Business Logic', () => {
  it('returns item by name (case-insensitive match)', async () => {
    // ARRANGE - Create an item
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT - Query with different case variations
    const responseLower = await request(app).get('/menu/name/espresso');
    const responseUpper = await request(app).get('/menu/name/ESPRESSO');
    const responseMixed = await request(app).get('/menu/name/EsPrEsSo');

    // ASSERT
    expect(responseLower.status).toBe(200);
    expect(responseLower.body.id).toBe(item.id);
    expect(responseLower.body.name).toBe('Espresso');

    expect(responseUpper.status).toBe(200);
    expect(responseUpper.body.id).toBe(item.id);
    expect(responseUpper.body.name).toBe('Espresso');

    expect(responseMixed.status).toBe(200);
    expect(responseMixed.body.id).toBe(item.id);
    expect(responseMixed.body.name).toBe('Espresso');
  });

  it('returns 404 when item not found', async () => {
    // ACT - Query with valid name format that doesn't exist
    const response = await request(app).get('/menu/name/NonExistentCoffee');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('returns 404 for soft-deleted item', async () => {
    // ARRANGE - Create and soft-delete an item
    const item = await createTestMenuItem({
      name: 'Deleted Coffee',
      price: 3.0,
      description: 'This coffee will be deleted',
    });

    // Soft delete it
    testDb
      .update(menuItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(menuItems.id, item.id))
      .run();

    // ACT - Try to query by name
    const response = await request(app).get('/menu/name/Deleted Coffee');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });
});

describe('GET /menu/price/:maxPrice - Parameter Validation', () => {
  it('returns 400 for invalid price (non-numeric)', async () => {
    // ACT
    const response = await request(app).get('/menu/price/abc');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for negative price', async () => {
    // ACT
    const response = await request(app).get('/menu/price/-5');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for zero price', async () => {
    // ACT
    const response = await request(app).get('/menu/price/0');

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for price with invalid format', async () => {
    // ACT - Test various invalid formats
    const response1 = await request(app).get('/menu/price/.5');
    const response2 = await request(app).get('/menu/price/5.5.5');

    // ASSERT
    expect(response1.status).toBe(400);
    expect(response1.body).toHaveProperty('error');
    expect(response1.body.error).toBe('Validation failed');

    expect(response2.status).toBe(400);
    expect(response2.body).toHaveProperty('error');
    expect(response2.body.error).toBe('Validation failed');
  });
});

describe('GET /menu/price/:maxPrice - Business Logic', () => {
  it('returns items with price <= maxPrice', async () => {
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
    const item4 = await createTestMenuItem({
      name: 'Mocha',
      price: 5.0,
      description: 'Espresso with chocolate',
    });

    // ACT - Query with maxPrice = 4.0
    const response = await request(app).get('/menu/price/4.0');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(3); // Should include item1, item2, item3

    const itemIds = response.body.map((item: { id: number }) => item.id);
    expect(itemIds).toContain(item1.id);
    expect(itemIds).toContain(item2.id);
    expect(itemIds).toContain(item3.id);
    expect(itemIds).not.toContain(item4.id); // item4 has price 5.0 > 4.0
  });

  it('returns empty array when no items match', async () => {
    // ARRANGE - Create items with prices above the threshold
    await createTestMenuItem({
      name: 'Espresso',
      price: 5.0,
      description: 'A strong and bold coffee',
    });
    await createTestMenuItem({
      name: 'Cappuccino',
      price: 6.0,
      description: 'Espresso with steamed milk foam',
    });

    // ACT - Query with maxPrice that's too low
    const response = await request(app).get('/menu/price/2.0');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(0);
  });

  it('excludes soft-deleted items', async () => {
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

    // Soft delete item2
    testDb
      .update(menuItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(menuItems.id, item2.id))
      .run();

    // ACT - Query with maxPrice that includes all items
    const response = await request(app).get('/menu/price/5.0');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body).toHaveLength(2); // Should include item1 and item3, but not item2

    const itemIds = response.body.map((item: { id: number }) => item.id);
    expect(itemIds).toContain(item1.id);
    expect(itemIds).toContain(item3.id);
    expect(itemIds).not.toContain(item2.id); // Soft-deleted item should be excluded
  });

  it('returns items with all required fields', async () => {
    // ARRANGE
    await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // ACT
    const response = await request(app).get('/menu/price/5.0');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);

    const item = response.body[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('price');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('createdAt');
    expect(item).toHaveProperty('updatedAt');
    expect(item).toHaveProperty('deletedAt');
  });
});
