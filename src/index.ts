import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CoffeeShopData, MenuItem, CreateMenuItemInput } from './types.js';

import { db } from './db';
import { menuItems, hours, special } from './db/schema';
import { eq, lte, sql, isNull, and } from 'drizzle-orm';

const app = express();
const PORT = 8080;

// Security: Disable X-Powered-By header to avoid exposing Express version
app.disable('x-powered-by');

// ============================================================================
// BASE VALUE SCHEMAS (reusable building blocks)
// ============================================================================

/**
 * Base schema for integer values (validates string, transforms to number)
 * Use this for route params, query strings, or any string-to-int conversion
 */
const intValueSchema = z
  .string()
  .regex(/^\d+$/, 'Must be a valid integer')
  .transform((val) => parseInt(val, 10));

/**
 * Base schema for floating-point numbers (validates string, transforms to number)
 * Ensures positive values - use this for prices, measurements, etc.
 */
const floatValueSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a valid number')
  .transform((val) => parseFloat(val))
  .pipe(z.number().positive('Must be a positive number'));

/**
 * Factory function for non-empty string values with length constraints
 * Automatically trims whitespace
 * @param min - Minimum length (inclusive)
 * @param max - Maximum length (inclusive)
 * @param fieldName - Name of the field for error messages
 */
const nonEmptyStringValueSchema = (
  min: number,
  max: number,
  fieldName: string
) =>
  z
    .string()
    .min(min, `${fieldName} must be at least ${min} characters`)
    .max(max, `${fieldName} must be at most ${max} characters`)
    .transform((val) => val.trim())
    .refine(
      (val) => val.length >= min,
      `${fieldName} cannot be empty after trimming`
    );

// ============================================================================
// PARAM SCHEMA FACTORIES (build route param schemas dynamically)
// ============================================================================

/**
 * Creates a Zod schema for validating an integer route parameter
 * @param paramName - The name of the route parameter (e.g., 'id', 'userId')
 * @returns A Zod schema that validates req.params[paramName]
 */
const createIntParamSchema = (paramName: string) =>
  z.object({
    [paramName]: intValueSchema,
  });

/**
 * Creates a Zod schema for validating a float route parameter (positive)
 * @param paramName - The name of the route parameter (e.g., 'maxPrice', 'amount')
 * @returns A Zod schema that validates req.params[paramName]
 */
const createFloatParamSchema = (paramName: string) =>
  z.object({
    [paramName]: floatValueSchema,
  });

/**
 * Creates a Zod schema for validating a string route parameter
 * @param paramName - The name of the route parameter (e.g., 'coffeeName', 'searchTerm')
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns A Zod schema that validates req.params[paramName]
 */
const createStringParamSchema = (paramName: string, min: number, max: number) =>
  z.object({
    [paramName]: nonEmptyStringValueSchema(min, max, paramName),
  });

// ============================================================================
// ROUTE PARAMETER SCHEMAS (using the factories)
// ============================================================================

// Real-world constraints:
// - Coffee names: 2-100 characters (too short looks like a typo, too long doesn't fit in UI)
// - IDs: Any positive integer
// - Prices: Any positive decimal number
const idParamSchema = createIntParamSchema('id');
const maxPriceParamSchema = createFloatParamSchema('maxPrice');
const coffeeNameParamSchema = createStringParamSchema('coffeeName', 2, 100);

// ============================================================================
// REQUEST BODY SCHEMAS
// ============================================================================

// Real-world constraints:
// - Menu item name: 2-100 characters
// - Description: 10-500 characters (needs to be descriptive but not too long)
// - Price: Positive number with reasonable max (e.g., $999.99)
const createMenuItemSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, 'Name cannot be empty after trimming'),
  price: z
    .number()
    .positive('Price must be a positive number')
    .max(999.99, 'Price must be reasonable (max $999.99)'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters')
    .transform((val) => val.trim())
    .refine(
      (val) => val.length >= 10,
      'Description cannot be empty after trimming'
    ),
});

// Schema for updating menu items (all fields optional)
const updateMenuItemSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters')
      .transform((val) => val.trim())
      .refine((val) => val.length >= 2, 'Name cannot be empty after trimming')
      .optional(),
    price: z
      .number()
      .positive('Price must be a positive number')
      .max(999.99, 'Price must be reasonable (max $999.99)')
      .optional(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(500, 'Description must be at most 500 characters')
      .transform((val) => val.trim())
      .refine(
        (val) => val.length >= 10,
        'Description cannot be empty after trimming'
      )
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided'
  );

// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================

/**
 * Filter condition to exclude soft-deleted menu items
 * Use this in all queries to ensure deleted items are not returned
 */
const notDeleted = isNull(menuItems.deletedAt);

// Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const current_date = new Date().toISOString();
  console.log(`[${current_date}] ${req.method} ${req.url}`);
  next();
});

// Add body parser middleware (BEFORE routes!)
app.use(express.json());

// GET routes

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to the Coffee Shop');
});

app.get('/menu/name/:coffeeName', (req: Request, res: Response) => {
  // Validate route parameter with Zod
  const result = coffeeNameParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // TypeScript now knows coffeeName is a valid, trimmed string!
  const { coffeeName } = result.data;

  // Case-insensitive search using SQLite LOWER() function
  const items = db
    .select()
    .from(menuItems)
    .where(
      and(sql`LOWER(${menuItems.name}) = LOWER(${coffeeName})`, notDeleted)
    )
    .all();

  if (items.length === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json(items[0]); // Return first match (should be unique due to schema constraint)
});

app.get('/menu/price/:maxPrice', (req: Request, res: Response) => {
  // Validate route parameter with Zod
  const result = maxPriceParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // TypeScript now knows maxPrice is a valid positive number!
  const { maxPrice } = result.data;

  // Query database and filter by price
  const items = db
    .select()
    .from(menuItems)
    .where(and(lte(menuItems.price, maxPrice), notDeleted))
    .all();
  res.json(items);
});

app.get('/menu/:id/description', (req: Request, res: Response) => {
  // Validate route parameter with Zod
  const result = idParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // TypeScript now knows id is a valid number!
  const { id } = result.data;

  // Query database for item by ID
  const item = db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, id), notDeleted))
    .get();

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const formattedPrice = item.price.toFixed(2);
  const formattedDescription = `${item.name} - ${item.description}. Only $${formattedPrice}!`;
  res.json({ description: formattedDescription });
});

app.get('/menu/:id', (req: Request, res: Response) => {
  // Validate route parameter with Zod
  const result = idParamSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // TypeScript now knows id is a valid number!
  const { id } = result.data;

  // Query database for item by ID (excluding soft-deleted items)
  const item = db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, id), notDeleted))
    .get();

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json(item);
});

app.get('/menu', (req, res) => {
  const items = db.select().from(menuItems).where(notDeleted).all();
  res.json(items);
});

app.get('/hours', (req: Request, res: Response) => {
  try {
    // Fetch store hours from database
    // Typically there's only one row with store hours, so we get the first one
    const storeHours = db.select().from(hours).get();

    if (!storeHours) {
      return res.status(404).json({ error: 'Store hours not found' });
    }

    res.json(storeHours);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to retrieve store hours' });
  }
});

app.get('/special', (req: Request, res: Response) => {
  try {
    // Fetch active daily specials from database
    // Filter by is_active = true to only return current active specials
    const activeSpecials = db
      .select()
      .from(special)
      .where(eq(special.is_active, true))
      .all();

    res.json(activeSpecials);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to retrieve daily specials' });
  }
});

// PATCH ROUTES

app.patch('/menu/:id', (req: Request, res: Response) => {
  // 1. Validate route parameter
  const paramResult = idParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: paramResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // 2. Validate request body
  const bodyResult = updateMenuItemSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: bodyResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  const { id } = paramResult.data;
  const updates = bodyResult.data;

  try {
    // 3. Check if item exists
    const existingItem = db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), notDeleted))
      .get();

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // 4. If updating name, check for duplicates (excluding current item and deleted items)
    if (updates.name) {
      const duplicate = db
        .select()
        .from(menuItems)
        .where(
          and(
            sql`LOWER(${menuItems.name}) = LOWER(${updates.name.trim()}) AND ${
              menuItems.id
            } != ${id}`,
            notDeleted
          )
        )
        .get();

      if (duplicate) {
        return res.status(409).json({
          error: 'Coffee with this name already exists',
        });
      }
    }

    // 5. Perform update
    db.update(menuItems)
      .set({
        ...updates,
        updatedAt: new Date(), // Explicitly set updatedAt
      })
      .where(eq(menuItems.id, id))
      .run();

    // 6. Fetch and return updated item
    const updatedItem = db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), notDeleted))
      .get();

    res.json(updatedItem);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to update menu item',
    });
  }
});

// POST routes

// Create POST endpoint
app.post('/menu', (req: Request, res: Response) => {
  // Validate with Zod - this replaces all the manual typeof checks!
  // It provides better error messages and type safety
  const result = createMenuItemSchema.safeParse(req.body);

  if (!result.success) {
    // Return validation errors in a user-friendly format
    const errors = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  // TypeScript now knows result.data is properly typed!
  const { name, price, description } = result.data;

  try {
    // Check for duplicates using case-insensitive search in database
    const existingItems = db
      .select()
      .from(menuItems)
      .where(
        and(sql`LOWER(${menuItems.name}) = LOWER(${name.trim()})`, notDeleted)
      )
      .all();

    if (existingItems.length > 0) {
      return res.status(409).json({
        error: 'Coffee with this name already exists',
      });
    }

    // Insert new item - database will auto-generate ID
    // Note: We don't need to manually set id, createdAt, or updatedAt
    // - id is auto-increment (primaryKey with autoIncrement)
    // - createdAt and updatedAt have $defaultFn(() => new Date())
    db.insert(menuItems).values({
      name: name.trim(),
      price: price,
      description: description.trim(),
    });

    // Fetch the newly inserted record using the unique name field
    // This approach is:
    // 1. Type-safe and clear - TypeScript knows the return type
    // 2. Reliable - name is unique, so we get exactly what we inserted
    // 3. Industry-standard pattern when ORM doesn't fully support RETURNING
    // 4. Efficient - single indexed lookup on unique field
    // 5. Returns complete record with all auto-generated fields (id, timestamps)
    const newItem = db
      .select()
      .from(menuItems)
      .where(eq(menuItems.name, name.trim()))
      .get();

    // This should never happen, but TypeScript safety check
    if (!newItem) {
      return res.status(500).json({ error: 'Failed to retrieve created item' });
    }

    // Send success response with new item
    res.status(201).json(newItem);
  } catch (error) {
    // Handle database constraint violations (e.g., unique constraint)
    // This is a safety net in case the duplicate check above fails
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({
        error: 'Coffee with this name already exists',
      });
    }

    // Log unexpected errors and return generic error message
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to create menu item',
    });
  }
});

// DELETE routes
app.delete('/menu/:id', (req: Request, res: Response) => {
  // 1. Validate route parameter
  const paramResult = idParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: paramResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  const { id } = paramResult.data;

  try {
    // 2. Check if item exists (excluding already soft-deleted items)
    const existingItem = db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), notDeleted))
      .get();

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // 3. Soft delete the item (set deletedAt timestamp)
    db.update(menuItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(), // Also update updatedAt for consistency
      })
      .where(eq(menuItems.id, id))
      .run();

    // 4. Fetch and return the soft-deleted item
    const deletedItem = db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .get();

    res.json({
      message: 'Item soft-deleted successfully',
      deletedItem: deletedItem,
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to soft-delete menu item',
    });
  }
});

app.delete('/menu/:id/hard-delete', (req: Request, res: Response) => {
  // 1. Validate route parameter
  const paramResult = idParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: paramResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  const { id } = paramResult.data;

  try {
    // 2. Check if item exists (and get it for response)
    const existingItem = db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), notDeleted))
      .get();

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // 3. Delete the item
    db.delete(menuItems).where(eq(menuItems.id, id)).run();

    // 4. Return deleted item (common REST pattern)
    res.json({
      message: 'Item deleted successfully',
      deletedItem: existingItem,
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to delete menu item',
    });
  }
});

// RESTORE routes
app.post('/menu/:id/restore', (req: Request, res: Response) => {
  // Step 1: Validate route parameter (same pattern as DELETE routes)
  // We use the same idParamSchema to ensure the ID is a valid integer
  const paramResult = idParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: paramResult.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Step 2: Extract the validated ID
  // TypeScript now knows 'id' is a number (not a string) thanks to Zod transformation
  const { id } = paramResult.data;

  try {
    // Step 3: Check if item exists AND is soft-deleted
    // We need to find items where:
    // - id matches
    // - deletedAt is NOT null (meaning it's soft-deleted)
    // We can't use 'notDeleted' here because we WANT deleted items!
    // Instead, we check if deletedAt IS NOT NULL
    const deletedItem = db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .get();

    // Step 4: Validation checks
    if (!deletedItem) {
      // Item doesn't exist at all (not even soft-deleted)
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!deletedItem.deletedAt) {
      // Item exists but is NOT deleted (it's already active)
      return res.status(400).json({
        error: 'Item is not deleted',
        message: 'This item is already active and does not need to be restored',
      });
    }

    // Step 5: Restore the item by clearing deletedAt
    // We set deletedAt to null and update updatedAt to current timestamp
    db.update(menuItems)
      .set({
        deletedAt: null, // Clear the soft-delete timestamp
        updatedAt: new Date(), // Update the timestamp to track when it was restored
      })
      .where(eq(menuItems.id, id))
      .run();

    // Step 6: Fetch and return the restored item
    // After updating, we fetch the item again to get the latest state
    // We use 'notDeleted' filter here because after restore, it should pass that check
    const restoredItem = db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), notDeleted))
      .get();

    // This should never fail, but TypeScript safety check
    if (!restoredItem) {
      return res
        .status(500)
        .json({ error: 'Failed to retrieve restored item' });
    }

    // Step 7: Return success response with restored item
    res.json({
      message: 'Item restored successfully',
      restoredItem: restoredItem,
    });
  } catch (error) {
    // Step 8: Error handling
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to restore menu item',
    });
  }
});

// Add a 404 handler at the end (after all routes)
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Could add error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
