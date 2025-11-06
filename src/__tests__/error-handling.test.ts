import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';

describe('404 Handler Tests', () => {
  it('returns 404 for non-existent route', async () => {
    // ACT
    const response = await request(app).get('/nonexistent');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Route not found');
  });

  it('returns 404 for non-existent route with different method', async () => {
    // ACT
    const response = await request(app).post('/nonexistent');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Route not found');
  });

  it('returns 404 for route with typo', async () => {
    // ACT - Typo of /menu
    const response = await request(app).get('/men');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Route not found');
  });

  it('returns 404 for nested non-existent route', async () => {
    // ACT
    const response = await request(app).get('/menu/123/nonexistent');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Route not found');
  });
});

describe('Root Endpoint Tests', () => {
  it('GET / returns welcome message', async () => {
    // ACT
    const response = await request(app).get('/');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.text).toBe('Welcome to the Coffee Shop');
  });

  it('GET / returns correct content type', async () => {
    // ACT
    const response = await request(app).get('/');

    // ASSERT
    expect(response.status).toBe(200);
    // Express send() defaults to text/html, but may vary
    expect(response.headers['content-type']).toMatch(/text\/(html|plain)/);
  });
});

describe('Error Middleware Tests', () => {
  it('handles malformed JSON in request body', async () => {
    // Suppress console.error to avoid noise from expected JSON parse error
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      // ACT - Send invalid JSON
      const response = await request(app)
        .post('/menu')
        .set('Content-Type', 'application/json')
        .send('{"name": "Espresso", "price": 2.5,}'); // Trailing comma - invalid JSON

      // ASSERT
      // Express json parser will return 400 for malformed JSON
      expect([400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    } finally {
      // Restore console.error
      consoleErrorSpy.mockRestore();
    }
  });

  it('handles very large request body', async () => {
    // ARRANGE - Create a very large JSON payload
    const largeName = 'A'.repeat(10000); // Very large name
    const largeDescription = 'B'.repeat(10000); // Very large description
    const largePayload = {
      name: largeName,
      price: 2.5,
      description: largeDescription,
    };

    // ACT
    const response = await request(app).post('/menu').send(largePayload);

    // ASSERT
    // Should either reject due to size limits or validation errors
    // Express has default body size limits, so this might return 400 or 413
    expect([400, 413, 500]).toContain(response.status);
    expect(response.body).toHaveProperty('error');
  });
});
