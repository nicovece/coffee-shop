import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { createTestSpecial } from './helpers';
import { testDb } from './setup';
import { special } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('POST /special - Success Cases', () => {
  it('creates special with valid data', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Holiday Special',
      price: 5.99,
      description: 'A special holiday coffee drink',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Holiday Special');
    expect(response.body.price).toBe(5.99);
    expect(response.body.description).toBe('A special holiday coffee drink');
  });

  it('returns 201 status code', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Weekend Special',
      price: 4.99,
      description: 'A special weekend coffee drink',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
  });

  it('returns created special with auto-generated id', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Morning Special',
      price: 3.99,
      description: 'A special morning coffee drink',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(typeof response.body.id).toBe('number');
    expect(response.body.id).toBeGreaterThan(0);
  });

  it('returns created special with timestamps', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Evening Special',
      price: 6.99,
      description: 'A special evening coffee drink',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
    expect(typeof response.body.createdAt).toBe('string');
    expect(typeof response.body.updatedAt).toBe('string');
    expect(new Date(response.body.createdAt).getTime()).toBeGreaterThan(0);
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it('defaults is_active to true when not provided', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Default Active Special',
      price: 4.99,
      description: 'A special that should be active by default',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.is_active).toBe(true);
  });

  it('respects is_active when explicitly set to false', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Inactive Special',
      price: 4.99,
      description: 'A special that should be inactive',
      is_active: false,
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.is_active).toBe(false);
  });
});

describe('POST /special - Missing Required Fields', () => {
  it('returns 400 for missing name', async () => {
    // ARRANGE
    const newSpecial = {
      price: 4.99,
      description: 'A special without a name',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for missing price', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Special Without Price',
      description: 'A special without a price',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });

  it('returns 400 for missing description', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Special Without Description',
      price: 4.99,
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
    expect(response.body).toHaveProperty('details');
  });
});

describe('POST /special - Name Validation', () => {
  it('returns 400 for name too short (< 2 chars)', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'A',
      price: 4.99,
      description: 'A special with a name too short',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 for name too long (> 100 chars)', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'A'.repeat(101),
      price: 4.99,
      description: 'A special with a name too long',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('trims whitespace from name', async () => {
    // ARRANGE
    const newSpecial = {
      name: '  Trimmed Special  ',
      price: 4.99,
      description: 'A special with trimmed name',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Trimmed Special');
  });

  it('returns 400 for empty string after trimming name', async () => {
    // ARRANGE
    const newSpecial = {
      name: '   ',
      price: 4.99,
      description: 'A special with only whitespace name',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('POST /special - Description Validation', () => {
  it('returns 400 for description too short (< 10 chars)', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Short Desc Special',
      price: 4.99,
      description: 'Short',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 for description too long (> 500 chars)', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Long Desc Special',
      price: 4.99,
      description: 'A'.repeat(501),
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('trims whitespace from description', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Trimmed Desc Special',
      price: 4.99,
      description: '  A description with whitespace  ',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.description).toBe('A description with whitespace');
  });

  it('returns 400 for empty string after trimming description', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Empty Desc Special',
      price: 4.99,
      description: '   ',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('POST /special - Price Validation', () => {
  it('returns 400 for negative price', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Negative Price Special',
      price: -1.99,
      description: 'A special with negative price',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 for zero price', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Zero Price Special',
      price: 0,
      description: 'A special with zero price',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 for price > 999.99', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Expensive Special',
      price: 1000.0,
      description: 'A special with price too high',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('returns 400 for non-numeric price', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Invalid Price Special',
      price: 'not-a-number',
      description: 'A special with invalid price',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('POST /special - Business Logic', () => {
  it('deactivates other active specials when creating new active special', async () => {
    // ARRANGE - Create an active special
    const existingSpecial = createTestSpecial({
      name: 'Existing Active Special',
      is_active: true,
    });

    // ACT - Create a new active special
    const response = await request(app).post('/special').send({
      name: 'New Active Special',
      price: 5.99,
      description: 'A new active special',
      is_active: true,
    });

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.is_active).toBe(true);

    // Verify the existing special is now inactive
    const updatedSpecial = testDb
      .select()
      .from(special)
      .where(eq(special.id, existingSpecial.id))
      .get();
    expect(updatedSpecial?.is_active).toBe(false);
  });

  it('does not deactivate others when creating inactive special', async () => {
    // ARRANGE - Create an active special
    const existingSpecial = createTestSpecial({
      name: 'Existing Active Special',
      is_active: true,
    });

    // ACT - Create a new inactive special
    const response = await request(app).post('/special').send({
      name: 'New Inactive Special',
      price: 5.99,
      description: 'A new inactive special',
      is_active: false,
    });

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.is_active).toBe(false);

    // Verify the existing special is still active
    const updatedSpecial = testDb
      .select()
      .from(special)
      .where(eq(special.id, existingSpecial.id))
      .get();
    expect(updatedSpecial?.is_active).toBe(true);
  });

  it('validates that valid_from is before valid_to', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Invalid Date Range Special',
      price: 4.99,
      description: 'A special with invalid date range',
      valid_from: '2024-12-31T00:00:00Z',
      valid_to: '2024-01-01T00:00:00Z', // After valid_from
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Validation failed');
  });

  it('accepts valid date range', async () => {
    // ARRANGE
    const newSpecial = {
      name: 'Valid Date Range Special',
      price: 4.99,
      description: 'A special with valid date range',
      valid_from: '2024-01-01T00:00:00Z',
      valid_to: '2024-12-31T00:00:00Z',
    };

    // ACT
    const response = await request(app).post('/special').send(newSpecial);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('valid_from');
    expect(response.body).toHaveProperty('valid_to');
  });
});

