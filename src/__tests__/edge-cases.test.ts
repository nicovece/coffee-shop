import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';

describe('Boundary Value Tests - Exact Limits', () => {
  it('creates item with name exactly 2 characters (minimum)', async () => {
    // ARRANGE
    const newItem = {
      name: 'AB', // Exactly 2 characters
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('AB');
    expect(response.body.name.length).toBe(2);
  });

  it('creates item with name exactly 100 characters (maximum)', async () => {
    // ARRANGE
    const name100 = 'A'.repeat(100); // Exactly 100 characters
    const newItem = {
      name: name100,
      price: 2.5,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe(name100);
    expect(response.body.name.length).toBe(100);
  });

  it('creates item with description exactly 10 characters (minimum)', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: '1234567890', // Exactly 10 characters
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.description).toBe('1234567890');
    expect(response.body.description.length).toBe(10);
  });

  it('creates item with description exactly 500 characters (maximum)', async () => {
    // ARRANGE
    const description500 = 'A'.repeat(500); // Exactly 500 characters
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: description500,
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.description).toBe(description500);
    expect(response.body.description.length).toBe(500);
  });

  it('creates item with price 0.01 (very small positive value)', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 0.01,
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.price).toBe(0.01);
  });

  it('creates item with price 999.99 (maximum allowed value)', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 999.99, // Maximum allowed price according to schema
      description: 'A strong and bold coffee',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.price).toBe(999.99);
  });
});

describe('Special Character Handling', () => {
  it('creates item with name containing special characters', async () => {
    // ARRANGE
    const newItem = {
      name: 'Café & Coffee! @#$%',
      price: 2.5,
      description: 'A strong and bold coffee with special characters',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Café & Coffee! @#$%');
    // Verify special characters are preserved
    expect(response.body.name).toContain('&');
    expect(response.body.name).toContain('!');
    expect(response.body.name).toContain('@');
  });

  it('creates item with name containing Unicode characters', async () => {
    // ARRANGE
    const newItem = {
      name: 'Café Español 中文 🎂',
      price: 2.5,
      description: 'A coffee with Unicode characters in the name',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Café Español 中文 🎂');
    // Verify Unicode characters are preserved
    expect(response.body.name).toContain('é');
    expect(response.body.name).toContain('ñ');
    expect(response.body.name).toContain('中');
    expect(response.body.name).toContain('🎂');
  });

  it('creates item with description containing special characters', async () => {
    // ARRANGE
    const newItem = {
      name: 'Espresso',
      price: 2.5,
      description: 'A strong & bold coffee! @#$%^&*()_+-=[]{}|;:\'",.<>?/~',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    expect(response.status).toBe(201);
    expect(response.body.description).toContain('&');
    expect(response.body.description).toContain('!');
    expect(response.body.description).toContain('@');
    expect(response.body.description).toContain('$');
  });

  it('creates item with name containing SQL injection attempt (treated as literal)', async () => {
    // ARRANGE - SQL injection attempt
    const newItem = {
      name: "'; DROP TABLE menuItems; --",
      price: 2.5,
      description: 'A coffee with SQL injection attempt in name',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    // Should succeed - the SQL injection string should be treated as literal text
    // If it were executed, the test database would be corrupted, but it should be safe
    expect(response.status).toBe(201);
    expect(response.body.name).toBe("'; DROP TABLE menuItems; --");

    // Verify the database still works by querying items
    const verifyResponse = await request(app).get('/menu');
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body).toBeInstanceOf(Array);
  });

  it('creates item with name containing HTML/script tags (treated as literal)', async () => {
    // ARRANGE - XSS attempt
    const newItem = {
      name: "<script>alert('xss')</script>",
      price: 2.5,
      description: 'A coffee with XSS attempt in name',
    };

    // ACT
    const response = await request(app).post('/menu').send(newItem);

    // ASSERT
    // Should succeed - the script tags should be treated as literal text
    // The API should not execute the script, just store it as data
    expect(response.status).toBe(201);
    expect(response.body.name).toBe("<script>alert('xss')</script>");

    // Verify the script tag is stored as literal text
    expect(response.body.name).toContain('<script>');
    expect(response.body.name).toContain('</script>');
  });
});
