import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CoffeeShopData, MenuItem, CreateMenuItemInput } from './types.js';

const app = express();
const PORT = 8080;

// Security: Disable X-Powered-By header to avoid exposing Express version
app.disable('x-powered-by');

// Load data from JSON file
const dataPath = path.join(process.cwd(), 'data.json');
let data: CoffeeShopData;

try {
  const fileContent = fs.readFileSync(dataPath, 'utf8');
  data = JSON.parse(fileContent) as CoffeeShopData;
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Error reading data.json:', errorMessage);
  process.exit(1);
}

// Extract data from the loaded JSON
const menu: MenuItem[] = data.menu;
const hours = data.hours;
const special = data.special;

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

  // Case-insensitive search
  const item = menu.find(
    (i) => i.name.toLowerCase() === coffeeName.toLowerCase()
  );

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  res.json(item);
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
  const items = menu.filter((item) => item.price <= maxPrice);
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
  const item = menu.find((item) => item.id === id);
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
  const item = menu.find((item) => item.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

app.get('/menu', (req: Request, res: Response) => {
  res.json(menu);
});

app.get('/hours', (req: Request, res: Response) => {
  res.json(hours);
});

app.get('/special', (req: Request, res: Response) => {
  res.json(special);
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

  // Check for duplicates (optional)
  const exists = menu.find(
    (item) => item.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    return res.status(409).json({
      error: 'Coffee with this name already exists',
    });
  }

  // Generate new ID
  const newId =
    menu.length > 0 ? Math.max(...menu.map((item) => item.id)) + 1 : 1;

  // Create new item - TypeScript ensures all fields are correct
  const newItem: MenuItem = {
    id: newId,
    name: name.trim(),
    price: price,
    description: description.trim(),
  };

  // Add to menu
  menu.push(newItem);

  // Send success response with new item
  res.status(201).json(newItem);
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
