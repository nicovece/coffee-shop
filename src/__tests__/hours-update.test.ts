import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { testDb } from './setup';
import { hours } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('PATCH /hours', () => {
  describe('When hours record exists (update scenario)', () => {
    it('updates existing hours with partial data', async () => {
      // ARRANGE - Create initial hours
      testDb.insert(hours).values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      }).run();

      const updateData = {
        monday: '7am - 9pm',
        friday: '8am - 10pm',
      };

      // ACT
      const response = await request(app).patch('/hours').send(updateData);

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.monday).toBe('7am - 9pm');
      expect(response.body.friday).toBe('8am - 10pm');
      // Other days should remain unchanged
      expect(response.body.tuesday).toBe('6am - 8pm');
      expect(response.body.wednesday).toBe('6am - 8pm');
      expect(response.body.thursday).toBe('6am - 8pm');
      expect(response.body.saturday).toBe('7am - 9pm');
      expect(response.body.sunday).toBe('7am - 7pm');
    });

    it('updates all days at once', async () => {
      // ARRANGE
      testDb.insert(hours).values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      }).run();

      const updateData = {
        monday: 'Closed',
        tuesday: 'Closed',
        wednesday: 'Closed',
        thursday: 'Closed',
        friday: 'Closed',
        saturday: 'Closed',
        sunday: 'Closed',
      };

      // ACT
      const response = await request(app).patch('/hours').send(updateData);

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.monday).toBe('Closed');
      expect(response.body.sunday).toBe('Closed');
    });
  });

  describe('When hours record does not exist (create scenario)', () => {
    it('creates new hours record with provided days and defaults for others', async () => {
      // ARRANGE - No hours exist (testDb is cleared in beforeEach)
      const updateData = {
        monday: '9am - 5pm',
        friday: '9am - 6pm',
      };

      // ACT
      const response = await request(app).patch('/hours').send(updateData);

      // ASSERT
      expect(response.status).toBe(201);
      expect(response.body.monday).toBe('9am - 5pm');
      expect(response.body.friday).toBe('9am - 6pm');
      // Days not provided should default to "Closed"
      expect(response.body.tuesday).toBe('Closed');
      expect(response.body.wednesday).toBe('Closed');
      expect(response.body.thursday).toBe('Closed');
      expect(response.body.saturday).toBe('Closed');
      expect(response.body.sunday).toBe('Closed');
      expect(response.body).toHaveProperty('id');
    });

    it('creates new hours record with all days provided', async () => {
      // ARRANGE
      const updateData = {
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      };

      // ACT
      const response = await request(app).patch('/hours').send(updateData);

      // ASSERT
      expect(response.status).toBe(201);
      expect(response.body.monday).toBe('6am - 8pm');
      expect(response.body.sunday).toBe('7am - 7pm');
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('Validation', () => {
    it('returns 400 when no fields are provided', async () => {
      // ACT
      const response = await request(app).patch('/hours').send({});

      // ASSERT
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body).toHaveProperty('details');
    });

    it('returns 400 when day value is empty after trimming', async () => {
      // ACT
      const response = await request(app)
        .patch('/hours')
        .send({ monday: '   ' });

      // ASSERT
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('returns 400 when day value exceeds max length', async () => {
      // ACT
      const longString = 'a'.repeat(51);
      const response = await request(app)
        .patch('/hours')
        .send({ monday: longString });

      // ASSERT
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('accepts valid hours formats - 12-hour formats', async () => {
      // ARRANGE
      testDb.insert(hours).values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      }).run();

      // ACT - Test various 12-hour formats
      const response = await request(app)
        .patch('/hours')
        .send({
          monday: '6am - 8pm',
          tuesday: '6:00am - 8:00pm',
          wednesday: '6:00 AM - 8:00 PM',
          thursday: '9 AM - 5 PM',
        });

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.monday).toBe('6am - 8pm');
      expect(response.body.tuesday).toBe('6:00am - 8:00pm');
      expect(response.body.wednesday).toBe('6:00 AM - 8:00 PM');
      expect(response.body.thursday).toBe('9 AM - 5 PM');
    });

    it('accepts valid hours formats - 24-hour formats', async () => {
      // ARRANGE
      testDb.insert(hours).values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      }).run();

      // ACT - Test various 24-hour formats
      const response = await request(app)
        .patch('/hours')
        .send({
          monday: '07:00 - 19:00',
          tuesday: '7.00 - 19.00',
          wednesday: '0700-1900',
          thursday: '09:00 to 17:00',
        });

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.monday).toBe('07:00 - 19:00');
      expect(response.body.tuesday).toBe('7.00 - 19.00');
      expect(response.body.wednesday).toBe('0700-1900');
      expect(response.body.thursday).toBe('09:00 to 17:00');
    });

    it('accepts valid hours formats - special keywords', async () => {
      // ARRANGE
      testDb.insert(hours).values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      }).run();

      // ACT - Test special keywords
      const response = await request(app)
        .patch('/hours')
        .send({
          monday: 'Closed',
          tuesday: 'closed',
          wednesday: 'CLOSED',
          thursday: 'Off',
          friday: '24 hours',
          saturday: '24h',
          sunday: '24/7',
        });

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.monday).toBe('Closed');
      expect(response.body.tuesday).toBe('closed');
      expect(response.body.wednesday).toBe('CLOSED');
      expect(response.body.thursday).toBe('Off');
      expect(response.body.friday).toBe('24 hours');
      expect(response.body.saturday).toBe('24h');
      expect(response.body.sunday).toBe('24/7');
    });

    it('rejects invalid hours formats', async () => {
      // ARRANGE
      testDb.insert(hours).values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      }).run();

      // ACT & ASSERT - Test invalid formats
      const invalidFormats = [
        'random text',
        '25:00 - 26:00', // Invalid hours
        '12:60 - 13:00', // Invalid minutes
        'just some words',
        '123456789', // Too many digits
      ];

      for (const invalidFormat of invalidFormats) {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: invalidFormat });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      }
    });
  });
});

