import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';

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
