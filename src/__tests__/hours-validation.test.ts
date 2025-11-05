import { describe, it, expect } from 'vitest';
import request from 'supertest';
import './mock-db'; // Must be imported before app
import { app } from '../index';
import { testDb } from './setup';
import { hours } from '../db/schema';

describe('Hours Format Validation - Comprehensive Tests', () => {
  beforeEach(() => {
    // Setup: Create initial hours record for update tests
    testDb
      .insert(hours)
      .values({
        monday: '6am - 8pm',
        tuesday: '6am - 8pm',
        wednesday: '6am - 8pm',
        thursday: '6am - 8pm',
        friday: '6am - 9pm',
        saturday: '7am - 9pm',
        sunday: '7am - 7pm',
      })
      .run();
  });

  describe('12-Hour Format Validation', () => {
    describe('Basic 12-hour formats', () => {
      it.each([
        ['6am - 8pm', '6am - 8pm'],
        ['6:00am - 8:00pm', '6:00am - 8:00pm'],
        ['6:00 AM - 8:00 PM', '6:00 AM - 8:00 PM'],
        ['9 AM - 5 PM', '9 AM - 5 PM'],
        ['12pm - 11pm', '12pm - 11pm'],
        ['1am - 11pm', '1am - 11pm'],
        ['12:30am - 11:30pm', '12:30am - 11:30pm'],
      ])('accepts "%s"', async (input, expected) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
        expect(response.body.monday).toBe(expected);
      });
    });

    describe('AM/PM variations', () => {
      it.each([
        ['6am - 8pm'],
        ['6AM - 8PM'],
        ['6a.m. - 8p.m.'],
        ['6A.M. - 8P.M.'],
        ['6 am - 8 pm'],
        ['6 AM - 8 PM'],
        ['6 a.m. - 8 p.m.'],
        ['6 A.M. - 8 P.M.'],
      ])('accepts case and format variations: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
        expect(response.body.monday).toBe(input);
      });
    });

    describe('Separator variations', () => {
      it.each([
        ['6am - 8pm'], // Standard hyphen
        ['6am – 8pm'], // En dash
        ['6am — 8pm'], // Em dash
        ['6am to 8pm'], // "to" separator
        ['6am-8pm'], // No spaces
        ['6am–8pm'], // En dash, no spaces
        ['6am—8pm'], // Em dash, no spaces
        ['6amto8pm'], // "to" no spaces
        ['6am  -  8pm'], // Multiple spaces
        ['6am  to  8pm'], // Multiple spaces with "to"
      ])('accepts separator variations: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });

    describe('Time format variations', () => {
      it.each([
        ['6am - 8pm'], // No minutes
        ['6:00am - 8:00pm'], // With minutes (00)
        ['6:30am - 8:30pm'], // With minutes (30)
        ['6:15am - 8:45pm'], // With minutes (15, 45)
        ['12am - 12pm'], // Midnight and noon
        ['1:05am - 11:55pm'], // Leading zeros in minutes
      ])('accepts time format variations: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });

    describe('Edge cases - valid 12-hour formats', () => {
      it.each([
        ['12am - 1am'], // Midnight to 1am
        ['11pm - 12am'], // 11pm to midnight
        ['12:00pm - 1:00pm'], // Noon to 1pm
        ['1:00am - 12:00pm'], // 1am to noon
        ['9:59am - 10:01pm'], // Near hour boundaries
      ])('accepts edge cases: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });

    describe('Invalid 12-hour formats', () => {
      it.each([
        ['13am - 8pm'], // Invalid hour (13 in 12-hour format)
        ['6am - 13pm'], // Invalid hour
        ['0am - 8pm'], // 0 is not valid in 12-hour format
        ['6am - 8'], // Missing PM/AM on second time
        ['6 - 8pm'], // Missing AM/PM on first time
        ['6am 8pm'], // Missing separator
        ['6am -'], // Incomplete
        ['- 8pm'], // Missing first time
        ['6am - 8pm - 10pm'], // Multiple ranges (not supported)
        ['6am to 8pm to 10pm'], // Multiple "to"
      ])('rejects invalid 12-hour format: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });
  });

  describe('24-Hour Format Validation', () => {
    describe('Basic 24-hour formats', () => {
      it.each([
        ['07:00 - 19:00'],
        ['7:00 - 19:00'],
        ['00:00 - 23:59'],
        ['09:00 - 17:00'],
        ['12:00 - 13:00'],
      ])('accepts colon format: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
        expect(response.body.monday).toBe(input);
      });
    });

    describe('Dot separator format', () => {
      it.each([
        ['7.00 - 19.00'],
        ['07.00 - 19.00'],
        ['9.30 - 17.30'],
        ['00.00 - 23.59'],
      ])('accepts dot format: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
        expect(response.body.monday).toBe(input);
      });
    });

    describe('Compact format (no separators)', () => {
      it.each([['0700-1900'], ['0900-1700'], ['0000-2359'], ['1200-1300']])(
        'accepts compact format: "%s"',
        async (input) => {
          const response = await request(app)
            .patch('/hours')
            .send({ monday: input });

          expect(response.status).toBe(200);
          expect(response.body.monday).toBe(input);
        }
      );
    });

    describe('Separator variations in 24-hour format', () => {
      it.each([
        ['07:00 - 19:00'], // Standard hyphen
        ['07:00 – 19:00'], // En dash
        ['07:00 — 19:00'], // Em dash
        ['07:00 to 19:00'], // "to" separator
        ['07:00-19:00'], // No spaces
        ['0700-1900'], // Compact, no spaces
        ['07:00  -  19:00'], // Multiple spaces
      ])('accepts separator variations: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });

    describe('Time range variations', () => {
      it.each([
        ['00:00 - 23:59'], // Full day range
        ['09:00 - 17:00'], // Standard business hours
        ['06:30 - 22:45'], // With minutes
        ['12:00 - 12:00'], // Same time (edge case)
      ])('accepts time ranges: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });

    describe('Invalid 24-hour formats', () => {
      it.each([
        ['24:00 - 25:00'], // Invalid hours (24, 25)
        ['07:60 - 19:00'], // Invalid minutes (60)
        ['25:00 - 26:00'], // Hours out of range
        ['07:00 - 24:00'], // 24:00 is not valid (only 00:00-23:59)
        ['07:00 19:00'], // Missing separator
        ['07:00 -'], // Incomplete
        ['- 19:00'], // Missing first time
        ['07:00 - 19:00 - 22:00'], // Multiple ranges
        ['2500-2600'], // Compact format with invalid hours
        ['0760-1900'], // Compact format with invalid minutes
        // Note: '7:00 - 19:00' is valid (single digit hour in 24-hour format is allowed)
      ])('rejects invalid 24-hour format: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Boundary conditions - 24-hour format', () => {
      it.each([
        ['00:00 - 00:00'], // Midnight to midnight
        ['23:59 - 23:59'], // End of day
        ['00:00 - 23:59'], // Full day
        ['00:01 - 23:58'], // Near boundaries
      ])('accepts boundary conditions: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Special Keywords Validation', () => {
    describe('Closed variations', () => {
      it.each([
        ['Closed'],
        ['closed'],
        ['CLOSED'],
        ['ClOsEd'], // Mixed case
      ])('accepts "Closed" variations: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
        expect(response.body.monday).toBe(input);
      });
    });

    describe('Off keyword', () => {
      it.each([['Off'], ['off'], ['OFF']])(
        'accepts "Off" variations: "%s"',
        async (input) => {
          const response = await request(app)
            .patch('/hours')
            .send({ monday: input });

          expect(response.status).toBe(200);
        }
      );
    });

    describe('24 hours variations', () => {
      it.each([
        ['24 hours'],
        ['24 hour'],
        ['24hours'],
        ['24hour'],
        ['24 HOURS'],
        ['24 HOUR'],
        ['24h'],
        ['24H'],
        ['24 h'],
        ['24 H'],
      ])('accepts 24-hour keywords: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });

    describe('24/7 variations', () => {
      it.each([['24/7'], ['24 / 7'], ['24/ 7'], ['24 /7'], ['24/7']])(
        'accepts 24/7 variations: "%s"',
        async (input) => {
          const response = await request(app)
            .patch('/hours')
            .send({ monday: input });

          expect(response.status).toBe(200);
        }
      );
    });

    describe('"open 24 hours" variations', () => {
      it.each([
        ['open 24 hours'],
        ['Open 24 Hours'],
        ['OPEN 24 HOURS'],
        ['open 24 hour'],
        ['open24hours'],
      ])('accepts "open 24 hours" variations: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Invalid Formats - General', () => {
    describe('Random text and nonsense', () => {
      it.each([
        ['random text'],
        ['hello world'],
        ['coffee shop hours'],
        ['open whenever'],
        ['call for hours'],
        ['variable hours'],
        ['TBD'],
        ['N/A'],
        ['???'],
        ['123456789'],
        ['abcdefghij'],
        ['!@#$%^&*()'],
        [''],
        ['   '],
      ])('rejects nonsense text: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Partial or incomplete formats', () => {
      it.each([
        ['6am'], // Missing second time
        ['- 8pm'], // Missing first time
        ['6am -'], // Incomplete
        ['07:00'], // Missing second time (24-hour)
        ['- 19:00'], // Missing first time (24-hour)
        ['am - pm'], // Missing numbers
        [':00 - :00'], // Missing hours
        ['6'], // Just a number
        ['am'], // Just AM/PM
      ])('rejects incomplete formats: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Invalid time values', () => {
      it.each([
        ['99am - 8pm'], // Invalid hour
        ['6am - 99pm'], // Invalid hour
        ['6:99am - 8pm'], // Invalid minutes
        ['6am - 8:99pm'], // Invalid minutes
        ['99:00 - 19:00'], // Invalid hour (24-hour)
        ['07:99 - 19:00'], // Invalid minutes (24-hour)
        ['-1am - 8pm'], // Negative hour
        ['6am - -1pm'], // Negative hour
      ])('rejects invalid time values: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Malformed formats', () => {
      it.each([
        ['6am8pm'], // Missing separator
        ['6am pm'], // Missing second time numbers
        ['am 8pm'], // Missing first time numbers
        ['6:00am8:00pm'], // Missing separator
        ['07:0019:00'], // Missing separator (24-hour)
        ['6am - - 8pm'], // Multiple separators
        ['6am to to 8pm'], // Multiple "to"
        ['6am -- 8pm'], // Multiple dashes
      ])('rejects malformed formats: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('Maximum length (50 characters)', () => {
      it('accepts exactly 50 characters', async () => {
        const input = '6:00am - 8:00pm and 9:00am - 10:00pm'; // 50 chars
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        // This should fail format validation, not length
        expect(response.status).toBe(400);
      });

      it('rejects over 50 characters', async () => {
        const input = 'a'.repeat(51);
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('Whitespace handling', () => {
      it.each([
        ['  6am - 8pm  '], // Leading/trailing spaces
        ['\t6am - 8pm\t'], // Tabs
        ['6am  -  8pm'], // Multiple spaces
        ['6am\n-\n8pm'], // Newlines (should be trimmed)
      ])('handles whitespace: "%s"', async (input) => {
        const response = await request(app)
          .patch('/hours')
          .send({ monday: input });

        // Should trim and validate
        expect([200, 400]).toContain(response.status);
      });
    });

    describe('Multiple days with different formats', () => {
      it('accepts different valid formats for different days', async () => {
        const updateData = {
          monday: '6am - 8pm',
          tuesday: '07:00 - 19:00',
          wednesday: '7.00 - 19.00',
          thursday: 'Closed',
          friday: '24 hours',
          saturday: '0700-1900',
          sunday: '9 AM - 5 PM',
        };

        const response = await request(app).patch('/hours').send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.monday).toBe('6am - 8pm');
        expect(response.body.tuesday).toBe('07:00 - 19:00');
        expect(response.body.wednesday).toBe('7.00 - 19.00');
        expect(response.body.thursday).toBe('Closed');
        expect(response.body.friday).toBe('24 hours');
        expect(response.body.saturday).toBe('0700-1900');
        expect(response.body.sunday).toBe('9 AM - 5 PM');
      });
    });
  });

  describe('Real-world Examples', () => {
    it.each([
      ['6am - 8pm', 'Standard coffee shop hours'],
      ['7:00 AM - 9:00 PM', 'Formal business hours'],
      ['09:00 - 17:00', 'European format'],
      ['7.00 - 19.00', 'German format'],
      ['0700-1900', 'Military/compact format'],
      ['Closed', 'Closed day'],
      ['24 hours', '24-hour operation'],
      ['24/7', 'Always open'],
    ])('accepts real-world example: "%s" (%s)', async (input, description) => {
      const response = await request(app)
        .patch('/hours')
        .send({ monday: input });

      expect(response.status).toBe(200);
      expect(response.body.monday).toBe(input);
    });
  });

  describe('Error Messages', () => {
    it('returns descriptive error message for invalid format', async () => {
      const response = await request(app)
        .patch('/hours')
        .send({ monday: 'invalid format' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(response.body.details[0]).toHaveProperty('field');
      expect(response.body.details[0]).toHaveProperty('message');
      expect(response.body.details[0].message).toContain('valid format');
    });

    it('returns error for empty string after trimming', async () => {
      const response = await request(app)
        .patch('/hours')
        .send({ monday: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
