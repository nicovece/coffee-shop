import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { testDb } from './setup';
import { hours } from '../db/schema';

describe('GET /hours', () => {
  it('returns 404 when no hours record exists', async () => {
    // ACT
    const response = await request(app).get('/hours');

    // ASSERT
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Store hours not found');
  });

  it('returns hours record when it exists', async () => {
    // ARRANGE - Create hours record
    testDb.insert(hours).values({
      monday: '6am - 8pm',
      tuesday: '6am - 8pm',
      wednesday: '6am - 8pm',
      thursday: '6am - 8pm',
      friday: '6am - 9pm',
      saturday: '7am - 9pm',
      sunday: '7am - 7pm',
    }).run();

    // ACT
    const response = await request(app).get('/hours');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('monday');
    expect(response.body).toHaveProperty('tuesday');
    expect(response.body).toHaveProperty('wednesday');
    expect(response.body).toHaveProperty('thursday');
    expect(response.body).toHaveProperty('friday');
    expect(response.body).toHaveProperty('saturday');
    expect(response.body).toHaveProperty('sunday');
    expect(response.body.monday).toBe('6am - 8pm');
    expect(response.body.friday).toBe('6am - 9pm');
    expect(response.body.sunday).toBe('7am - 7pm');
  });

  it('returns hours with all required fields', async () => {
    // ARRANGE - Create hours record
    testDb.insert(hours).values({
      monday: '8am - 6pm',
      tuesday: '8am - 6pm',
      wednesday: '8am - 6pm',
      thursday: '8am - 6pm',
      friday: '8am - 7pm',
      saturday: '9am - 5pm',
      sunday: 'Closed',
    }).run();

    // ACT
    const response = await request(app).get('/hours');

    // ASSERT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('monday');
    expect(response.body).toHaveProperty('tuesday');
    expect(response.body).toHaveProperty('wednesday');
    expect(response.body).toHaveProperty('thursday');
    expect(response.body).toHaveProperty('friday');
    expect(response.body).toHaveProperty('saturday');
    expect(response.body).toHaveProperty('sunday');
    
    // Verify all days are present
    expect(typeof response.body.monday).toBe('string');
    expect(typeof response.body.tuesday).toBe('string');
    expect(typeof response.body.wednesday).toBe('string');
    expect(typeof response.body.thursday).toBe('string');
    expect(typeof response.body.friday).toBe('string');
    expect(typeof response.body.saturday).toBe('string');
    expect(typeof response.body.sunday).toBe('string');
  });
});

