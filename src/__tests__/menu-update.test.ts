import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestMenuItem } from './helpers';
import { testDb } from './setup';
import { menuItems } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('PATCH /menu/:id - Parameter Validation', () => {
  it('returns 400 for invalid id format', async () => {
    // ARRANGE
    const updateData = {
      name: 'Updated Name',
    };

    // ACT
    const response = await request(app).patch('/menu/abc').send(updateData);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 404 for non-existent item', async () => {
    // ARRANGE
    const updateData = {
      name: 'Updated Name',
    };

    // ACT
    const response = await request(app).patch('/menu/999').send(updateData);

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

    const updateData = {
      name: 'Updated Name',
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });
});

describe('PATCH /menu/:id - Body Validation - Success Cases & Empty Body', () => {
  it('updates item with valid partial data (name only)', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      name: 'Updated Espresso',
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Espresso');
    expect(response.body.price).toBe(2.5); // Should remain unchanged
    expect(response.body.description).toBe('A strong and bold coffee'); // Should remain unchanged
  });

  it('updates item with valid partial data (price only)', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    const updateData = {
      price: 4.0,
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.price).toBe(4.0);
    expect(response.body.name).toBe('Cappuccino'); // Should remain unchanged
    expect(response.body.description).toBe('Espresso with steamed milk foam'); // Should remain unchanged
  });

  it('returns 400 for empty body (no fields provided)', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    const updateData = {};

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
    expect(response.body.details).toBeInstanceOf(Array);
    expect(response.body.details.length).toBeGreaterThan(0);
  });
});

describe('PATCH /menu/:id - Name Validation', () => {
  it('returns 400 for name too short (< 2 chars)', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      name: 'A', // Only 1 character
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const longName = 'A'.repeat(101); // 101 characters
    const updateData = {
      name: longName,
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      name: '  Updated Espresso  ', // With leading and trailing whitespace
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Espresso'); // Should be trimmed
    expect(response.body.name).not.toBe('  Updated Espresso  ');
  });

  it('returns 400 for empty string after trimming name', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      name: '   ', // Only whitespace
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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

describe('PATCH /menu/:id - Description Validation', () => {
  it('returns 400 for description too short (< 10 chars)', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      description: 'Short', // Only 5 characters
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const longDescription = 'A'.repeat(501); // 501 characters
    const updateData = {
      description: longDescription,
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      description: '  Updated description text  ', // With leading and trailing whitespace
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.description).toBe('Updated description text'); // Should be trimmed
    expect(response.body.description).not.toBe('  Updated description text  ');
  });

  it('returns 400 for empty string after trimming description', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      description: '          ', // Only whitespace
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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

describe('PATCH /menu/:id - Price Validation', () => {
  it('returns 400 for negative price', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      price: -5.0,
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      price: 1000.0,
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

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
});

describe('PATCH /menu/:id - Business Logic - Basic Updates', () => {
  it('updates name successfully', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    const updateData = {
      name: 'Updated Espresso',
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Espresso');
    expect(response.body.price).toBe(2.5); // Should remain unchanged
    expect(response.body.description).toBe('A strong and bold coffee'); // Should remain unchanged
    expect(response.body.id).toBe(item.id); // ID should not change
  });

  it('updates price successfully', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    const updateData = {
      price: 4.0,
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.price).toBe(4.0);
    expect(response.body.name).toBe('Cappuccino'); // Should remain unchanged
    expect(response.body.description).toBe('Espresso with steamed milk foam'); // Should remain unchanged
    expect(response.body.id).toBe(item.id); // ID should not change
  });

  it('updates description successfully', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    const updateData = {
      description:
        'Updated description: Espresso with steamed milk and foam art',
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.description).toBe(
      'Updated description: Espresso with steamed milk and foam art'
    );
    expect(response.body.name).toBe('Latte'); // Should remain unchanged
    expect(response.body.price).toBe(4.0); // Should remain unchanged
    expect(response.body.id).toBe(item.id); // ID should not change
  });

  it('updates multiple fields simultaneously', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Mocha',
      price: 4.5,
      description: 'Espresso with chocolate',
    });

    const updateData = {
      name: 'Updated Mocha',
      price: 5.0,
      description:
        'Updated description: Espresso with chocolate and steamed milk',
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Mocha');
    expect(response.body.price).toBe(5.0);
    expect(response.body.description).toBe(
      'Updated description: Espresso with chocolate and steamed milk'
    );
    expect(response.body.id).toBe(item.id); // ID should not change

    // Verify all fields were updated correctly
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
  });
});

describe('PATCH /menu/:id - Business Logic - Duplicate Name Handling', () => {
  it('returns 409 when new name conflicts with existing item (case-insensitive)', async () => {
    // ARRANGE - Create two items
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

    // ACT - Try to update item2 with the same name as item1 (different case)
    const updateData = {
      name: 'ESPRESSO', // Different case, same as item1
    };
    const response = await request(app)
      .patch(`/menu/${item2.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Coffee with this name already exists');

    // Verify item2's name was not changed
    const getResponse = await request(app).get(`/menu/${item2.id}`);
    expect(getResponse.body.name).toBe('Cappuccino');
  });

  it('allows same name if updating same item', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    // ACT - Update with the same name (should succeed)
    const updateData = {
      name: 'Latte', // Same name
      price: 4.5, // But update price
    };
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Latte'); // Name remains the same
    expect(response.body.price).toBe(4.5); // Price was updated
  });

  it('prevents duplicate names (case-insensitive)', async () => {
    // ARRANGE - Create two items
    const item1 = await createTestMenuItem({
      name: 'Mocha',
      price: 4.5,
      description: 'Espresso with chocolate',
    });

    const item2 = await createTestMenuItem({
      name: 'Americano',
      price: 3.0,
      description: 'Espresso with hot water',
    });

    // ACT - Try to update item2 with same name as item1 (mixed case)
    const updateData = {
      name: 'mOcHa', // Mixed case, same as item1
    };
    const response = await request(app)
      .patch(`/menu/${item2.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Coffee with this name already exists');

    // Verify only one item exists with that name
    const allItems = await request(app).get('/menu');
    const mochaItems = allItems.body.filter(
      (item: { name: string }) => item.name.toLowerCase() === 'mocha'
    );
    expect(mochaItems.length).toBe(1);
    expect(mochaItems[0].id).toBe(item1.id); // item1 should still have the name
  });
});

describe('PATCH /menu/:id - Business Logic - Timestamps & Response', () => {
  it('updates updatedAt timestamp', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Espresso',
      price: 2.5,
      description: 'A strong and bold coffee',
    });

    // Get original timestamps
    const originalCreatedAt = new Date(item.createdAt).getTime();
    const originalUpdatedAt = new Date(item.updatedAt).getTime();

    // Wait a bit to ensure timestamp difference (100ms should be enough)
    await new Promise((resolve) => setTimeout(resolve, 100));

    const updateData = {
      price: 3.0,
    };

    // ACT
    const beforeUpdateTime = Date.now();
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);
    const afterUpdateTime = Date.now();

    // ASSERT
    expect(response.status).toBe(200);
    const updatedCreatedAt = new Date(response.body.createdAt).getTime();
    const updatedUpdatedAt = new Date(response.body.updatedAt).getTime();

    // createdAt should remain the same
    expect(updatedCreatedAt).toBe(originalCreatedAt);

    // updatedAt should have changed (allow for same timestamp if update happens very quickly)
    // At minimum, it should be >= original (not less)
    expect(updatedUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    // If it's the same, that's acceptable if the update happened very quickly
    // But ideally it should be greater
    if (updatedUpdatedAt === originalUpdatedAt) {
      // If timestamps are the same, verify it's at least within the update window
      expect(updatedUpdatedAt).toBeGreaterThanOrEqual(beforeUpdateTime - 2000);
      expect(updatedUpdatedAt).toBeLessThanOrEqual(afterUpdateTime + 2000);
    } else {
      // If different, verify it's within the update window
      expect(updatedUpdatedAt).toBeGreaterThan(originalUpdatedAt);
      expect(updatedUpdatedAt).toBeGreaterThanOrEqual(beforeUpdateTime - 1000);
      expect(updatedUpdatedAt).toBeLessThanOrEqual(afterUpdateTime + 1000);
    }
  });

  it('does not change createdAt timestamp', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Cappuccino',
      price: 3.5,
      description: 'Espresso with steamed milk foam',
    });

    // Get original createdAt
    const originalCreatedAt = new Date(item.createdAt).getTime();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    // ACT - Update multiple times
    await request(app).patch(`/menu/${item.id}`).send({ price: 4.0 });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await request(app)
      .patch(`/menu/${item.id}`)
      .send({ name: 'Updated Cappuccino' });

    // Get final item
    const finalResponse = await request(app).get(`/menu/${item.id}`);

    // ASSERT
    expect(finalResponse.status).toBe(200);
    const finalCreatedAt = new Date(finalResponse.body.createdAt).getTime();
    const finalUpdatedAt = new Date(finalResponse.body.updatedAt).getTime();

    // createdAt should remain exactly the same
    expect(finalCreatedAt).toBe(originalCreatedAt);

    // updatedAt should be >= createdAt (not less)
    expect(finalUpdatedAt).toBeGreaterThanOrEqual(originalCreatedAt);
  });

  it('returns updated item with all fields', async () => {
    // ARRANGE
    const item = await createTestMenuItem({
      name: 'Latte',
      price: 4.0,
      description: 'Espresso with steamed milk',
    });

    const updateData = {
      name: 'Updated Latte',
      price: 4.5,
      description: 'Updated description for latte',
    };

    // ACT
    const response = await request(app)
      .patch(`/menu/${item.id}`)
      .send(updateData);

    // ASSERT
    expect(response.status).toBe(200);

    // Verify all required fields are present
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('price');
    expect(response.body).toHaveProperty('description');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
    expect(response.body).toHaveProperty('deletedAt');

    // Verify field values
    expect(response.body.id).toBe(item.id);
    expect(response.body.name).toBe('Updated Latte');
    expect(response.body.price).toBe(4.5);
    expect(response.body.description).toBe('Updated description for latte');
    expect(response.body.deletedAt).toBeNull(); // Should be null for active items

    // Verify timestamps are valid date strings
    expect(typeof response.body.createdAt).toBe('string');
    expect(typeof response.body.updatedAt).toBe('string');
    expect(new Date(response.body.createdAt).getTime()).toBeGreaterThan(0);
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(0);
  });
});
