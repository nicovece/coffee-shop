"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const db_1 = require("./db");
const schema_1 = require("./db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const app = (0, express_1.default)();
exports.app = app;
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
const intValueSchema = zod_1.z
    .string()
    .regex(/^\d+$/, 'Must be a valid integer')
    .transform((val) => parseInt(val, 10));
/**
 * Base schema for floating-point numbers (validates string, transforms to number)
 * Ensures positive values - use this for prices, measurements, etc.
 */
const floatValueSchema = zod_1.z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Must be a valid number')
    .transform((val) => parseFloat(val))
    .pipe(zod_1.z.number().positive('Must be a positive number'));
/**
 * Factory function for non-empty string values with length constraints
 * Automatically trims whitespace
 * @param min - Minimum length (inclusive)
 * @param max - Maximum length (inclusive)
 * @param fieldName - Name of the field for error messages
 */
const nonEmptyStringValueSchema = (min, max, fieldName) => zod_1.z
    .string()
    .min(min, `${fieldName} must be at least ${min} characters`)
    .max(max, `${fieldName} must be at most ${max} characters`)
    .transform((val) => val.trim())
    .refine((val) => val.length >= min, `${fieldName} cannot be empty after trimming`);
/**
 * Validates store hours format
 * Accepts:
 * - 12-hour formats: "6am - 8pm", "6:00am - 8:00pm", "6:00 AM - 8:00 PM", "9 AM - 5 PM"
 * - 24-hour formats: "07:00 - 19:00", "7.00 - 19.00", "0700-1900"
 * - Special keywords: "Closed", "Off", "24 hours", "24h", "24/7", "open 24 hours"
 * - Flexible spacing, dashes (-, –, —), and "to" as separator
 */
const isValidHoursFormat = (value) => {
    const trimmed = value.trim();
    // Special keywords (case-insensitive)
    const specialKeywords = /^(closed|off|24\s*h(?:ours?)?|24\s*\/\s*7|open\s*24\s*hours?)$/i;
    if (specialKeywords.test(trimmed)) {
        return true;
    }
    // 12-hour format patterns
    // Matches: 6am - 8pm, 6:00am - 8:00pm, 6:00 AM - 8:00 PM, 9 AM - 5 PM
    // Flexible: am/a.m./AM/A.M., spacing, dashes (-, –, —), "to"
    const twelveHourPattern = /^(\d{1,2}(?::\d{2})?)\s*(?:am|a\.m\.|pm|p\.m\.|AM|A\.M\.|PM|P\.M\.)\s*(?:[-–—]|to)\s*(\d{1,2}(?::\d{2})?)\s*(?:am|a\.m\.|pm|p\.m\.|AM|A\.M\.|PM|P\.M\.)$/i;
    // 24-hour format patterns
    // Matches: 07:00 - 19:00, 7.00 - 19.00, 0700-1900
    // Flexible: colons or dots, with or without separators, dashes (-, –, —), "to"
    const twentyFourHourPattern1 = /^(\d{1,2}[.:]\d{2})\s*(?:[-–—]|to)\s*(\d{1,2}[.:]\d{2})$/; // 07:00 - 19:00 or 7.00 - 19.00
    const twentyFourHourPattern2 = /^(\d{3,4})\s*(?:[-–—]|to)\s*(\d{3,4})$/; // 0700-1900
    // Check if matches 12-hour format
    if (twelveHourPattern.test(trimmed)) {
        // Validate hours are in valid range (1-12) and minutes (00-59)
        const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:am|a\.m\.|pm|p\.m\.|AM|A\.M\.|PM|P\.M\.)\s*(?:[-–—]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|a\.m\.|pm|p\.m\.|AM|A\.M\.|PM|P\.M\.)$/i);
        if (match) {
            const startHour = parseInt(match[1], 10);
            const startMinutes = match[2] ? parseInt(match[2], 10) : 0;
            const endHour = parseInt(match[3], 10);
            const endMinutes = match[4] ? parseInt(match[4], 10) : 0;
            // Validate hours are 1-12 and minutes are 0-59
            if (startHour < 1 || startHour > 12 || startMinutes > 59)
                return false;
            if (endHour < 1 || endHour > 12 || endMinutes > 59)
                return false;
            return true;
        }
    }
    // Check if matches 24-hour format
    if (twentyFourHourPattern1.test(trimmed) ||
        twentyFourHourPattern2.test(trimmed)) {
        // Validate hours are in valid range (00-23) and minutes (00-59)
        let times = [];
        // Extract times based on format
        if (twentyFourHourPattern1.test(trimmed)) {
            // Format: 07:00 - 19:00 or 7.00 - 19.00
            const match = trimmed.match(/(\d{1,2}[.:]\d{2})/g);
            if (match)
                times = match;
        }
        else if (twentyFourHourPattern2.test(trimmed)) {
            // Format: 0700-1900
            const match = trimmed.match(/(\d{3,4})/g);
            if (match)
                times = match;
        }
        // Validate each time
        for (const time of times) {
            let hours, minutes;
            if (time.length === 4 && !time.includes(':') && !time.includes('.')) {
                // Format: 0700
                hours = parseInt(time.substring(0, 2), 10);
                minutes = parseInt(time.substring(2, 4), 10);
            }
            else {
                // Format: 07:00 or 7.00
                const parts = time.split(/[:.]/);
                hours = parseInt(parts[0], 10);
                minutes = parseInt(parts[1] || '0', 10);
            }
            if (hours > 23 || minutes > 59)
                return false;
        }
        return true;
    }
    return false;
};
/**
 * Factory function for validating store hours day fields
 * Returns an optional schema that validates hours format when provided
 * @param dayName - Name of the day for error messages (e.g., 'Monday', 'Tuesday')
 */
const hoursDaySchema = (dayName) => zod_1.z
    .string()
    .max(50, `${dayName} hours must be at most 50 characters`)
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, `${dayName} hours cannot be empty after trimming`)
    .refine((val) => isValidHoursFormat(val), `${dayName} hours must be in a valid format (e.g., "6am - 8pm", "07:00 - 19:00", "Closed")`)
    .optional();
// ============================================================================
// PARAM SCHEMA FACTORIES (build route param schemas dynamically)
// ============================================================================
/**
 * Creates a Zod schema for validating an integer route parameter
 * @param paramName - The name of the route parameter (e.g., 'id', 'userId')
 * @returns A Zod schema that validates req.params[paramName]
 */
const createIntParamSchema = (paramName) => zod_1.z.object({
    [paramName]: intValueSchema,
});
/**
 * Creates a Zod schema for validating a float route parameter (positive)
 * @param paramName - The name of the route parameter (e.g., 'maxPrice', 'amount')
 * @returns A Zod schema that validates req.params[paramName]
 */
const createFloatParamSchema = (paramName) => zod_1.z.object({
    [paramName]: floatValueSchema,
});
/**
 * Creates a Zod schema for validating a string route parameter
 * @param paramName - The name of the route parameter (e.g., 'coffeeName', 'searchTerm')
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns A Zod schema that validates req.params[paramName]
 */
const createStringParamSchema = (paramName, min, max) => zod_1.z.object({
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
// REQUEST BODY SCHEMA FACTORIES (reusable field validators)
// ============================================================================
/**
 * Schema factory for name fields (shared by menu items and specials)
 * Validates: 2-100 characters, trimmed, non-empty
 */
const nameSchema = () => zod_1.z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, 'Name cannot be empty after trimming');
/**
 * Schema factory for price fields (shared by menu items and specials)
 * Validates: Positive number, max $999.99
 */
const priceSchema = () => zod_1.z
    .number()
    .positive('Price must be a positive number')
    .max(999.99, 'Price must be reasonable (max $999.99)');
/**
 * Schema factory for description fields (shared by menu items and specials)
 * Validates: 10-500 characters, trimmed, non-empty
 */
const descriptionSchema = () => zod_1.z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters')
    .transform((val) => val.trim())
    .refine((val) => val.length >= 10, 'Description cannot be empty after trimming');
// ============================================================================
// REQUEST BODY SCHEMAS
// ============================================================================
// Real-world constraints:
// - Menu item name: 2-100 characters
// - Description: 10-500 characters (needs to be descriptive but not too long)
// - Price: Positive number with reasonable max (e.g., $999.99)
const createMenuItemSchema = zod_1.z.object({
    name: nameSchema(),
    price: priceSchema(),
    description: descriptionSchema(),
});
// Schema for updating menu items (all fields optional)
const updateMenuItemSchema = zod_1.z
    .object({
    name: nameSchema().optional(),
    price: priceSchema().optional(),
    description: descriptionSchema().optional(),
})
    .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');
// Schema for updating store hours (all day fields optional, but at least one required)
const updateHoursSchema = zod_1.z
    .object({
    monday: hoursDaySchema('Monday'),
    tuesday: hoursDaySchema('Tuesday'),
    wednesday: hoursDaySchema('Wednesday'),
    thursday: hoursDaySchema('Thursday'),
    friday: hoursDaySchema('Friday'),
    saturday: hoursDaySchema('Saturday'),
    sunday: hoursDaySchema('Sunday'),
})
    .refine((data) => Object.keys(data).length > 0, 'At least one day must be provided');
// Schema for creating a new special
const createSpecialSchema = zod_1.z
    .object({
    name: nameSchema(),
    price: priceSchema(),
    description: descriptionSchema(),
    is_active: zod_1.z.boolean().optional().default(true),
    valid_from: zod_1.z
        .string()
        .datetime('valid_from must be a valid ISO date string')
        .optional(),
    valid_to: zod_1.z
        .string()
        .datetime('valid_to must be a valid ISO date string')
        .optional(),
})
    .refine((data) => {
    // If both dates are provided, valid_from must be before valid_to
    if (data.valid_from && data.valid_to) {
        return new Date(data.valid_from) < new Date(data.valid_to);
    }
    return true;
}, {
    message: 'valid_from must be before valid_to',
    path: ['valid_from'],
});
// Schema for updating a special (all fields optional)
const updateSpecialSchema = zod_1.z
    .object({
    name: nameSchema().optional(),
    price: priceSchema().optional(),
    description: descriptionSchema().optional(),
    is_active: zod_1.z.boolean().optional(),
    valid_from: zod_1.z
        .string()
        .datetime('valid_from must be a valid ISO date string')
        .nullable()
        .optional(),
    valid_to: zod_1.z
        .string()
        .datetime('valid_to must be a valid ISO date string')
        .nullable()
        .optional(),
})
    .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided')
    .refine((data) => {
    // If both dates are provided, valid_from must be before valid_to
    if (data.valid_from && data.valid_to) {
        return new Date(data.valid_from) < new Date(data.valid_to);
    }
    return true;
}, {
    message: 'valid_from must be before valid_to',
    path: ['valid_from'],
});
// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================
/**
 * Filter condition to exclude soft-deleted menu items
 * Use this in all queries to ensure deleted items are not returned
 */
const notDeleted = (0, drizzle_orm_1.isNull)(schema_1.menuItems.deletedAt);
/**
 * Filter condition to exclude soft-deleted specials
 * Use this in all queries to ensure deleted specials are not returned
 */
const notDeletedSpecial = (0, drizzle_orm_1.isNull)(schema_1.special.deletedAt);
// Middleware
app.use((req, res, next) => {
    const current_date = new Date().toISOString();
    console.log(`[${current_date}] ${req.method} ${req.url}`);
    next();
});
// Add body parser middleware (BEFORE routes!)
app.use(express_1.default.json());
// GET routes
app.get('/', (req, res) => {
    res.send('Welcome to the Coffee Shop');
});
app.get('/menu/name/:coffeeName', (req, res) => {
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
    const items = db_1.db
        .select()
        .from(schema_1.menuItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `LOWER(${schema_1.menuItems.name}) = LOWER(${coffeeName})`, notDeleted))
        .all();
    if (items.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(items[0]); // Return first match (should be unique due to schema constraint)
});
app.get('/menu/price/:maxPrice', (req, res) => {
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
    const items = db_1.db
        .select()
        .from(schema_1.menuItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.lte)(schema_1.menuItems.price, maxPrice), notDeleted))
        .all();
    res.json(items);
});
app.get('/menu/:id/description', (req, res) => {
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
    const item = db_1.db
        .select()
        .from(schema_1.menuItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), notDeleted))
        .get();
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    const formattedPrice = item.price.toFixed(2);
    const formattedDescription = `${item.name} - ${item.description}. Only $${formattedPrice}!`;
    res.json({ description: formattedDescription });
});
app.get('/menu/:id', (req, res) => {
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
    const item = db_1.db
        .select()
        .from(schema_1.menuItems)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), notDeleted))
        .get();
    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
});
app.get('/menu', (req, res) => {
    const items = db_1.db.select().from(schema_1.menuItems).where(notDeleted).all();
    res.json(items);
});
app.get('/hours', (req, res) => {
    try {
        // Fetch store hours from database
        // Typically there's only one row with store hours, so we get the first one
        const storeHours = db_1.db.select().from(schema_1.hours).get();
        if (!storeHours) {
            return res.status(404).json({ error: 'Store hours not found' });
        }
        res.json(storeHours);
    }
    catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Failed to retrieve store hours' });
    }
});
app.get('/specials', (req, res) => {
    try {
        // Fetch all daily specials from database (active and inactive)
        // This endpoint returns all specials regardless of status
        // Useful for admin views where you need to see all specials
        // Exclude soft-deleted specials
        const allSpecials = db_1.db
            .select()
            .from(schema_1.special)
            .where(notDeletedSpecial)
            .all();
        res.json(allSpecials);
    }
    catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Failed to retrieve daily specials' });
    }
});
app.get('/specials/active', (req, res) => {
    try {
        // Fetch only active daily specials from database
        // This endpoint filters by is_active = true to return only current active specials
        // This is the public-facing endpoint for customers to see current specials
        // Since we ensure only one special is active at a time, this typically returns one special
        // Exclude soft-deleted specials
        const activeSpecials = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.is_active, true), notDeletedSpecial))
            .all();
        res.json(activeSpecials);
    }
    catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Failed to retrieve active daily specials' });
    }
});
app.get('/specials/:id', (req, res) => {
    // Step 1: Validate route parameter
    // The idParamSchema validates that the :id parameter is a valid integer
    // It converts the string parameter to a number automatically
    const result = idParamSchema.safeParse(req.params);
    if (!result.success) {
        // If validation fails, return 400 (Bad Request) with error details
        return res.status(400).json({
            error: 'Validation failed',
            details: result.error.issues.map((err) => ({
                field: err.path.join('.'), // Join the path array: ["id"] -> "id"
                message: err.message, // Error message from Zod
            })),
        });
    }
    // Step 2: Extract the validated ID
    // TypeScript now knows 'id' is a number (not a string) thanks to Zod transformation
    const { id } = result.data;
    try {
        // Step 3: Query the database for the special by ID
        // Exclude soft-deleted specials
        const specialItem = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.id, id), notDeletedSpecial))
            .get();
        // Step 4: Check if the special was found
        if (!specialItem) {
            // If no special found, return 404 (Not Found)
            // This is the standard HTTP status for "resource doesn't exist"
            return res.status(404).json({ error: 'Special not found' });
        }
        // Step 5: Return the special
        // HTTP 200 (OK) is the default status for successful GET requests
        // Return the complete special object with all fields
        res.json(specialItem);
    }
    catch (error) {
        // Step 6: Handle database errors
        // This catches any unexpected database errors (connection issues, etc.)
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to retrieve special',
        });
    }
});
// PATCH ROUTES
app.patch('/menu/:id', (req, res) => {
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
        const existingItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), notDeleted))
            .get();
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // 4. If updating name, check for duplicates (excluding current item and deleted items)
        if (updates.name) {
            const duplicate = db_1.db
                .select()
                .from(schema_1.menuItems)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `LOWER(${schema_1.menuItems.name}) = LOWER(${updates.name.trim()}) AND ${schema_1.menuItems.id} != ${id}`, notDeleted))
                .get();
            if (duplicate) {
                return res.status(409).json({
                    error: 'Coffee with this name already exists',
                });
            }
        }
        // 5. Perform update
        db_1.db.update(schema_1.menuItems)
            .set({
            ...updates,
            updatedAt: new Date(), // Explicitly set updatedAt
        })
            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
            .run();
        // 6. Fetch and return updated item
        const updatedItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), notDeleted))
            .get();
        if (!updatedItem) {
            return res.status(500).json({ error: 'Failed to retrieve updated item' });
        }
        res.json(updatedItem);
    }
    catch (error) {
        // Handle database constraint violations (e.g., unique constraint)
        if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({
                error: 'Coffee with this name already exists',
            });
        }
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to update menu item',
        });
    }
});
app.patch('/special/:id', (req, res) => {
    // Step 1: Validate route parameter
    // The idParamSchema ensures the :id parameter is a valid integer
    // It automatically converts the string to a number
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
        // If ID validation fails, return 400 (Bad Request)
        return res.status(400).json({
            error: 'Validation failed',
            details: paramResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            })),
        });
    }
    // Step 2: Validate request body
    // The updateSpecialSchema validates that:
    // - At least one field is provided
    // - All provided fields meet validation rules
    // - Date ranges are valid (valid_from < valid_to)
    const bodyResult = updateSpecialSchema.safeParse(req.body);
    if (!bodyResult.success) {
        // If body validation fails, return 400 with detailed error messages
        return res.status(400).json({
            error: 'Validation failed',
            details: bodyResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            })),
        });
    }
    // Step 3: Extract validated data
    // TypeScript now knows:
    // - id is a number (from route param validation)
    // - updates contains only valid fields with correct types
    const { id } = paramResult.data;
    const updates = bodyResult.data;
    try {
        // Step 4: Check if the special exists
        // Exclude soft-deleted specials
        const existingSpecial = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.id, id), notDeletedSpecial))
            .get();
        if (!existingSpecial) {
            // If special doesn't exist, return 404 (Not Found)
            return res.status(404).json({ error: 'Special not found' });
        }
        // Step 5: Handle mutually exclusive is_active logic
        // If we're setting this special to active (is_active = true),
        // we need to deactivate all other active specials first
        // This ensures only one special is active at a time
        if (updates.is_active === true) {
            // Find all currently active specials (excluding the one we're updating)
            const otherActiveSpecials = db_1.db
                .select()
                .from(schema_1.special)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.is_active, true), (0, drizzle_orm_1.sql) `${schema_1.special.id} != ${id}`))
                .all();
            // If there are other active specials, deactivate them
            if (otherActiveSpecials.length > 0) {
                db_1.db.update(schema_1.special)
                    .set({ is_active: false })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.is_active, true), (0, drizzle_orm_1.sql) `${schema_1.special.id} != ${id}`))
                    .run();
            }
        }
        // Step 6: Prepare update data
        // We need to:
        // - Convert ISO date strings to Date objects (if provided)
        // - Handle null values (to clear dates)
        // - Keep other fields as-is
        const updateData = {};
        // Add simple fields if they're being updated
        if (updates.name !== undefined) {
            updateData.name = updates.name.trim(); // Already trimmed by schema, but extra safety
        }
        if (updates.price !== undefined) {
            updateData.price = updates.price;
        }
        if (updates.description !== undefined) {
            updateData.description = updates.description.trim();
        }
        if (updates.is_active !== undefined) {
            updateData.is_active = updates.is_active;
        }
        // Handle date fields - they can be:
        // - ISO string (convert to Date) - to set a date
        // - null (clear the date) - to remove the date
        // - undefined (don't change) - handled by the if check above
        if (updates.valid_from !== undefined) {
            // If it's null, set to null (clears the date)
            // If it's a string, convert to Date object
            updateData.valid_from =
                updates.valid_from === null ? null : new Date(updates.valid_from);
        }
        if (updates.valid_to !== undefined) {
            // Same logic for valid_to
            updateData.valid_to =
                updates.valid_to === null ? null : new Date(updates.valid_to);
        }
        // Step 7: Perform the update
        // Only update fields that were provided (updateData only contains provided fields)
        db_1.db.update(schema_1.special).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.special.id, id)).run();
        // Step 8: Fetch and return the updated special
        // We fetch again to ensure we return the latest state from the database
        const updatedSpecial = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.eq)(schema_1.special.id, id))
            .get();
        // Step 9: Safety check (should never happen, but TypeScript requires it)
        if (!updatedSpecial) {
            return res.status(500).json({
                error: 'Failed to retrieve updated special',
            });
        }
        // Step 10: Return the updated special
        // HTTP 200 (OK) is the standard response for successful PATCH requests
        res.json(updatedSpecial);
    }
    catch (error) {
        // Step 11: Handle errors
        // Database errors could be constraint violations or connection issues
        if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({
                error: 'Special with this name already exists',
            });
        }
        // Log error for debugging
        console.error('Database error:', error);
        // Return generic error message
        return res.status(500).json({
            error: 'Failed to update special',
        });
    }
});
app.patch('/hours', (req, res) => {
    // 1. Validate request body
    const bodyResult = updateHoursSchema.safeParse(req.body);
    if (!bodyResult.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: bodyResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            })),
        });
    }
    try {
        // 2. Check if hours record exists
        const existingHours = db_1.db.select().from(schema_1.hours).get();
        if (existingHours) {
            // 3. If exists: update only provided fields
            db_1.db.update(schema_1.hours)
                .set({
                ...bodyResult.data,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.hours.id, existingHours.id))
                .run();
            // 4. Fetch and return updated hours
            const updatedHours = db_1.db
                .select()
                .from(schema_1.hours)
                .where((0, drizzle_orm_1.eq)(schema_1.hours.id, existingHours.id))
                .get();
            if (!updatedHours) {
                return res
                    .status(500)
                    .json({ error: 'Failed to retrieve updated hours' });
            }
            return res.json(updatedHours);
        }
        else {
            // 5. If not exists: create new record
            // Provide default "Closed" for days not specified
            const defaultHours = 'Closed';
            const newHours = {
                monday: bodyResult.data.monday ?? defaultHours,
                tuesday: bodyResult.data.tuesday ?? defaultHours,
                wednesday: bodyResult.data.wednesday ?? defaultHours,
                thursday: bodyResult.data.thursday ?? defaultHours,
                friday: bodyResult.data.friday ?? defaultHours,
                saturday: bodyResult.data.saturday ?? defaultHours,
                sunday: bodyResult.data.sunday ?? defaultHours,
            };
            db_1.db.insert(schema_1.hours).values(newHours).run();
            // Fetch and return created hours
            const createdHours = db_1.db.select().from(schema_1.hours).get();
            if (!createdHours) {
                return res
                    .status(500)
                    .json({ error: 'Failed to retrieve created hours' });
            }
            return res.status(201).json(createdHours);
        }
    }
    catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to update store hours',
        });
    }
});
// POST routes
// Create POST endpoint
app.post('/menu', (req, res) => {
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
        const existingItems = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `LOWER(${schema_1.menuItems.name}) = LOWER(${name.trim()})`, notDeleted))
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
        db_1.db.insert(schema_1.menuItems)
            .values({
            name: name.trim(),
            price: price,
            description: description.trim(),
        })
            .run();
        // Fetch the newly inserted record using the unique name field
        // This approach is:
        // 1. Type-safe and clear - TypeScript knows the return type
        // 2. Reliable - name is unique, so we get exactly what we inserted
        // 3. Industry-standard pattern when ORM doesn't fully support RETURNING
        // 4. Efficient - single indexed lookup on unique field
        // 5. Returns complete record with all auto-generated fields (id, timestamps)
        const newItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.name, name.trim()))
            .get();
        // This should never happen, but TypeScript safety check
        if (!newItem) {
            return res.status(500).json({ error: 'Failed to retrieve created item' });
        }
        // Send success response with new item
        res.status(201).json(newItem);
    }
    catch (error) {
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
// POST /special - Create a new daily special
app.post('/special', (req, res) => {
    // Step 1: Validate request body using Zod schema
    // safeParse() returns a result object that either:
    // - success: true with validated data (TypeScript knows the types)
    // - success: false with error details (what went wrong)
    const result = createSpecialSchema.safeParse(req.body);
    // Step 2: If validation failed, return user-friendly error messages
    if (!result.success) {
        // Map Zod errors to a clean format:
        // - field: which field had the error (e.g., "name", "price", "valid_from")
        // - message: what was wrong (e.g., "Name must be at least 2 characters")
        const errors = result.error.issues.map((err) => ({
            field: err.path.join('.'), // Join path array: ["valid_from"] -> "valid_from"
            message: err.message,
        }));
        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
        });
    }
    // Step 3: Extract validated data
    // TypeScript now knows these are the correct types
    // result.data has: name (string), price (number), description (string),
    //                  is_active (boolean | undefined), valid_from (string | undefined),
    //                  valid_to (string | undefined)
    const { name, price, description, is_active, valid_from, valid_to } = result.data;
    try {
        // Step 4: Determine if the new special should be active
        // Default to true if not provided, but respect explicit false
        const willBeActive = is_active ?? true;
        // Step 5: If creating an active special, deactivate all other specials first
        // This ensures only one special is active at a time (mutually exclusive)
        // Why do this before insert? To maintain data consistency:
        // - If we insert first, there's a brief moment where two are active
        // - By deactivating first, we ensure atomicity
        if (willBeActive) {
            // Find all currently active specials and deactivate them
            const activeSpecials = db_1.db
                .select()
                .from(schema_1.special)
                .where((0, drizzle_orm_1.eq)(schema_1.special.is_active, true))
                .all();
            // If there are active specials, deactivate them all
            if (activeSpecials.length > 0) {
                // Update all active specials to inactive
                // We use a WHERE clause to update only active ones
                db_1.db.update(schema_1.special)
                    .set({ is_active: false })
                    .where((0, drizzle_orm_1.eq)(schema_1.special.is_active, true))
                    .run();
            }
        }
        // Step 6: Prepare data for database insertion
        // The database stores dates as timestamps (integers), but we received ISO strings
        // We need to convert ISO date strings to Date objects, which the ORM will convert to timestamps
        // Build the insert object with only the fields we want to save
        const specialData = {
            name: name.trim(), // Trim whitespace (already done by schema, but extra safety)
            price: price,
            description: description.trim(),
            is_active: willBeActive, // Use the determined value
            // Convert ISO date strings to Date objects for database storage
            // If valid_from is provided, convert it; otherwise don't include it
            ...(valid_from && { valid_from: new Date(valid_from) }),
            ...(valid_to && { valid_to: new Date(valid_to) }),
        };
        // Step 7: Insert the new special into the database
        // The database will auto-generate the ID (primaryKey with autoIncrement)
        db_1.db.insert(schema_1.special).values(specialData).run();
        // Step 8: Fetch the newly created special
        // Since we don't have a unique constraint on name (unlike menu items), we can't fetch by name
        // We'll use SQL's MAX(id) to get the most recently inserted record
        // This works because:
        // 1. IDs are auto-incrementing, so the highest ID is the most recent insert
        // 2. SQLite guarantees atomicity, so this is safe even with concurrent requests
        // 3. This is simpler and more efficient than querying by multiple fields
        const newSpecial = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.eq)(schema_1.special.id, (0, drizzle_orm_1.sql) `(SELECT MAX(id) FROM daily_special)`))
            .get();
        // Step 9: Safety check - this should never happen, but TypeScript requires it
        if (!newSpecial) {
            return res.status(500).json({
                error: 'Failed to retrieve created special',
            });
        }
        // Step 10: Return success response with the created special
        // HTTP 201 (Created) indicates a new resource was successfully created
        // Include the full special object with all fields (id, timestamps if any, etc.)
        res.status(201).json(newSpecial);
    }
    catch (error) {
        // Step 11: Handle errors
        // Database errors could be:
        // - Constraint violations (e.g., if we add unique constraints later)
        // - Connection issues
        // - Other unexpected errors
        // Check if it's a constraint violation (like duplicate name, if we add that constraint)
        if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({
                error: 'Special with this name already exists',
            });
        }
        // Log the error for debugging (in production, use proper logging)
        console.error('Database error:', error);
        // Return generic error message (don't expose internal details to users)
        return res.status(500).json({
            error: 'Failed to create special',
        });
    }
});
// DELETE routes
app.delete('/menu/:id', (req, res) => {
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
        const existingItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), notDeleted))
            .get();
        if (!existingItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        // 3. Soft delete the item (set deletedAt timestamp)
        db_1.db.update(schema_1.menuItems)
            .set({
            deletedAt: new Date(),
            updatedAt: new Date(), // Also update updatedAt for consistency
        })
            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
            .run();
        // 4. Fetch and return the soft-deleted item
        const deletedItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
            .get();
        res.json({
            message: 'Item soft-deleted successfully',
            deletedItem: deletedItem,
        });
    }
    catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to soft-delete menu item',
        });
    }
});
app.delete('/menu/:id/hard-delete', (req, res) => {
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
        // 2. Check if item exists AND is soft-deleted (all in one query)
        // This ensures we only hard-delete items that are already soft-deleted
        const existingItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), (0, drizzle_orm_1.isNotNull)(schema_1.menuItems.deletedAt)))
            .get();
        if (!existingItem) {
            // Item doesn't exist OR is not soft-deleted
            // Check if item exists at all to provide better error message
            const anyItem = db_1.db
                .select()
                .from(schema_1.menuItems)
                .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
                .get();
            if (!anyItem) {
                return res.status(404).json({ error: 'Item not found' });
            }
            // Item exists but is not soft-deleted
            return res.status(400).json({
                error: 'Cannot hard delete active item',
                message: 'Item must be soft-deleted first',
            });
        }
        // 3. Delete the item (we know it's soft-deleted from the query above)
        db_1.db.delete(schema_1.menuItems).where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id)).run();
        // 4. Return deleted item (common REST pattern)
        res.json({
            message: 'Item deleted successfully',
            deletedItem: existingItem,
        });
    }
    catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to delete menu item',
        });
    }
});
// DELETE /special/:id - Soft delete a special
app.delete('/special/:id', (req, res) => {
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
        // 2. Check if special exists (excluding already soft-deleted specials)
        const existingSpecial = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.id, id), notDeletedSpecial))
            .get();
        if (!existingSpecial) {
            return res.status(404).json({ error: 'Special not found' });
        }
        // 3. Soft delete the special (set deletedAt timestamp)
        db_1.db.update(schema_1.special)
            .set({
            deletedAt: new Date(),
            updatedAt: new Date(), // Also update updatedAt for consistency
        })
            .where((0, drizzle_orm_1.eq)(schema_1.special.id, id))
            .run();
        // 4. Fetch and return the soft-deleted special
        const deletedSpecial = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.eq)(schema_1.special.id, id))
            .get();
        res.json({
            message: 'Special soft-deleted successfully',
            deletedSpecial: deletedSpecial,
        });
    }
    catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to soft-delete special',
        });
    }
});
// DELETE /special/:id/hard-delete - Hard delete a soft-deleted special
app.delete('/special/:id/hard-delete', (req, res) => {
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
        // 2. Check if special exists AND is soft-deleted (all in one query)
        // This ensures we only hard-delete specials that are already soft-deleted
        const existingSpecial = db_1.db
            .select()
            .from(schema_1.special)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.special.id, id), (0, drizzle_orm_1.isNotNull)(schema_1.special.deletedAt)))
            .get();
        if (!existingSpecial) {
            // Special doesn't exist OR is not soft-deleted
            // Check if special exists at all to provide better error message
            const anySpecial = db_1.db
                .select()
                .from(schema_1.special)
                .where((0, drizzle_orm_1.eq)(schema_1.special.id, id))
                .get();
            if (!anySpecial) {
                return res.status(404).json({ error: 'Special not found' });
            }
            // Special exists but is not soft-deleted
            return res.status(400).json({
                error: 'Cannot hard delete active special',
                message: 'Special must be soft-deleted first',
            });
        }
        // 3. Delete the special (we know it's soft-deleted from the query above)
        db_1.db.delete(schema_1.special).where((0, drizzle_orm_1.eq)(schema_1.special.id, id)).run();
        // 4. Return deleted special (common REST pattern)
        res.json({
            message: 'Special deleted successfully',
            deletedSpecial: existingSpecial,
        });
    }
    catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to delete special',
        });
    }
});
// RESTORE routes
app.post('/menu/:id/restore', (req, res) => {
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
        const deletedItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
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
        db_1.db.update(schema_1.menuItems)
            .set({
            deletedAt: null, // Clear the soft-delete timestamp
            updatedAt: new Date(), // Update the timestamp to track when it was restored
        })
            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
            .run();
        // Step 6: Fetch and return the restored item
        // After updating, we fetch the item again to get the latest state
        // We use 'notDeleted' filter here because after restore, it should pass that check
        const restoredItem = db_1.db
            .select()
            .from(schema_1.menuItems)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id), notDeleted))
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
    }
    catch (error) {
        // Step 8: Error handling
        console.error('Database error:', error);
        return res.status(500).json({
            error: 'Failed to restore menu item',
        });
    }
});
// Add a 404 handler at the end (after all routes)
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Could add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
// Only start server if this file is run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
