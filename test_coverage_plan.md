# Test Coverage Plan for Coffee Shop API

## Current Test Coverage

### ✅ Already Tested

- `GET /menu` - Returns all menu items (empty array + with items)
- `GET /menu/:id` - Returns item by id, 404 for non-existent, 400 for invalid id

### ❌ Missing Test Coverage

---

## 1. GET Routes

### 1.1 `GET /` (Root Endpoint)

- ✅ Returns welcome message
- ✅ Returns 200 status

### 1.2 `GET /menu` (Already has basic tests)

**Additional edge cases to add:**

- ✅ Returns empty array when no items exist (already tested)
- ✅ Returns all non-deleted items (already tested)
- ✅ Excludes soft-deleted items from results
- ✅ Returns items with all required fields (id, name, price, description, createdAt, updatedAt)

### 1.3 `GET /menu/:id` (Already has basic tests)

**Additional edge cases to add:**

- ✅ Returns specific item by id (already tested)
- ✅ Returns 404 for non-existent item (already tested)
- ✅ Returns 400 for invalid id format (already tested)
- ⚠️ Returns 404 for soft-deleted item (should not return deleted items)
- ⚠️ Returns 400 for negative id
- ⚠️ Returns 400 for zero id
- ⚠️ Returns 400 for non-integer id (e.g., "1.5")

### 1.4 `GET /menu/:id/description`

- ✅ Returns formatted description with name, description, and price
- ✅ Returns 404 for non-existent item
- ✅ Returns 404 for soft-deleted item
- ✅ Returns 400 for invalid id format
- ✅ Price is formatted to 2 decimal places
- ✅ Description format: "{name} - {description}. Only ${price}!"

### 1.5 `GET /menu/name/:coffeeName`

- ✅ Returns item by name (case-insensitive match)
- ✅ Returns 404 when item not found
- ✅ Returns 400 for invalid name (too short: < 2 chars)
- ✅ Returns 400 for invalid name (too long: > 100 chars)
- ✅ Returns 400 for empty string (after trimming)
- ✅ Case-insensitive matching works (e.g., "Espresso" matches "espresso")
- ✅ Returns 404 for soft-deleted item
- ✅ Trims whitespace from name

### 1.6 `GET /menu/price/:maxPrice`

- ✅ Returns items with price <= maxPrice
- ✅ Returns empty array when no items match
- ✅ Returns 400 for invalid price (non-numeric)
- ✅ Returns 400 for negative price
- ✅ Returns 400 for zero price
- ✅ Returns 400 for price with invalid format
- ✅ Excludes soft-deleted items
- ✅ Returns items sorted correctly (if sorting is implemented)

### 1.7 `GET /hours`

- ✅ Returns store hours when data exists
- ✅ Returns 404 when no hours data exists
- ✅ Returns 500 on database error
- ✅ Returns all required day fields (monday through sunday)

### 1.8 `GET /special`

- ✅ Returns only active specials (is_active = true)
- ✅ Excludes inactive specials
- ✅ Returns empty array when no active specials exist
- ✅ Returns 500 on database error
- ✅ Returns all required fields (id, name, price, description, is_active)

---

## 2. POST Routes

### 2.1 `POST /menu` (Create Menu Item)

**Validation Tests:**

- ✅ Creates menu item with valid data
- ✅ Returns 201 status code
- ✅ Returns created item with auto-generated id
- ✅ Returns created item with timestamps (createdAt, updatedAt)
- ✅ Returns 400 for missing name
- ✅ Returns 400 for missing price
- ✅ Returns 400 for missing description
- ✅ Returns 400 for name too short (< 2 chars)
- ✅ Returns 400 for name too long (> 100 chars)
- ✅ Returns 400 for description too short (< 10 chars)
- ✅ Returns 400 for description too long (> 500 chars)
- ✅ Returns 400 for negative price
- ✅ Returns 400 for zero price
- ✅ Returns 400 for price > 999.99
- ✅ Returns 400 for non-numeric price
- ✅ Trims whitespace from name and description
- ✅ Returns 400 for empty string after trimming

**Business Logic Tests:**

- ✅ Returns 409 when duplicate name exists (case-insensitive)
- ✅ Prevents duplicate names (case-insensitive check)
- ✅ Returns 409 for duplicate name even if one is soft-deleted
- ✅ Returns 500 on database error
- ✅ Auto-generates unique id
- ✅ Sets createdAt and updatedAt timestamps

---

## 3. PATCH Routes

### 3.1 `PATCH /menu/:id` (Update Menu Item)

**Parameter Validation:**

- ✅ Returns 400 for invalid id format
- ✅ Returns 404 for non-existent item
- ✅ Returns 404 for soft-deleted item

**Body Validation:**

- ✅ Updates item with valid partial data (name only)
- ✅ Updates item with valid partial data (price only)
- ✅ Returns 400 for empty body (no fields provided)
- ✅ Returns 400 for name too short
- ✅ Returns 400 for name too long
- ✅ Returns 400 for description too short
- ✅ Returns 400 for description too long
- ✅ Returns 400 for negative price
- ✅ Returns 400 for price > 999.99
- ✅ Trims whitespace from name and description
- ✅ Returns 400 for empty string after trimming

**Business Logic Tests:**

- ✅ Updates name successfully
- ✅ Updates price successfully
- ✅ Updates description successfully
- ✅ Updates multiple fields simultaneously
- ✅ Returns 409 when new name conflicts with existing item (case-insensitive)
- ✅ Allows same name if updating same item
- ✅ Prevents duplicate names (case-insensitive)
- ✅ Updates updatedAt timestamp
- ✅ Does not change createdAt timestamp
- ✅ Returns updated item with all fields
- ✅ Returns 500 on database error

---

## 4. DELETE Routes

### 4.1 `DELETE /menu/:id` (Soft Delete)

**Parameter Validation:**

- ✅ Returns 400 for invalid id format
- ✅ Returns 404 for non-existent item
- ✅ Returns 404 for already soft-deleted item

**Business Logic Tests:**

- ✅ Soft deletes item successfully
- ✅ Sets deletedAt timestamp
- ✅ Updates updatedAt timestamp
- ✅ Returns 200 with deleted item
- ✅ Soft-deleted item no longer appears in GET /menu
- ✅ Soft-deleted item no longer appears in GET /menu/:id
- ✅ Soft-deleted item no longer appears in GET /menu/name/:coffeeName
- ✅ Soft-deleted item no longer appears in GET /menu/price/:maxPrice
- ✅ Returns 500 on database error

### 4.2 `DELETE /menu/:id/hard-delete` (Hard Delete)

**Parameter Validation:**

- ✅ Returns 400 for invalid id format
- ✅ Returns 404 for non-existent item
- ✅ Returns 400 for active item (not soft-deleted)

**Business Logic Tests:**

- ✅ Hard deletes soft-deleted item successfully
- ✅ Returns 200 with deleted item info
- ✅ Item is permanently removed from database
- ✅ Returns 400 when trying to hard-delete active item
- ✅ Returns 500 on database error

---

## 5. RESTORE Routes

### 5.1 `POST /menu/:id/restore`

**Parameter Validation:**

- ✅ Returns 400 for invalid id format
- ✅ Returns 404 for non-existent item
- ✅ Returns 400 for item that is not deleted

**Business Logic Tests:**

- ✅ Restores soft-deleted item successfully
- ✅ Clears deletedAt timestamp (sets to null)
- ✅ Updates updatedAt timestamp
- ✅ Restored item appears in GET /menu
- ✅ Restored item appears in GET /menu/:id
- ✅ Restored item can be queried by name
- ✅ Returns 200 with restored item
- ✅ Returns 500 on database error

---

## 6. Error Handling & Edge Cases

### 6.1 404 Handler

- ✅ Returns 404 for non-existent routes
- ✅ Returns JSON error response

### 6.2 Error Middleware

- ✅ Handles unexpected errors gracefully
- ✅ Returns 500 status code
- ✅ Returns JSON error response
- ✅ Logs error to console

### 6.3 Middleware

- ✅ Logging middleware logs requests correctly
- ✅ JSON body parser works correctly

### 6.4 Soft Delete Behavior (Integration)

- ✅ Soft-deleted items are excluded from all GET endpoints
- ✅ Soft-deleted items can be restored
- ✅ Soft-deleted items can be hard-deleted
- ✅ Restored items behave normally
- ✅ Duplicate name check excludes soft-deleted items when creating new items
- ✅ Duplicate name check excludes soft-deleted items when updating items

---

## 7. Data Integrity Tests

### 7.1 Timestamps

- ✅ createdAt is set on creation and never changes
- ✅ updatedAt is set on creation
- ✅ updatedAt changes on update
- ✅ updatedAt changes on soft delete
- ✅ updatedAt changes on restore
- ✅ deletedAt is null for active items
- ✅ deletedAt is set on soft delete
- ✅ deletedAt is cleared on restore

### 7.2 Unique Constraints

- ✅ Name uniqueness is enforced (case-insensitive)
- ✅ Name uniqueness check excludes soft-deleted items for new items
- ✅ Name uniqueness check excludes current item when updating

---

## 8. Performance & Edge Cases

### 8.1 Large Data Sets

- ✅ GET /menu handles large number of items efficiently
- ✅ GET /menu/price/:maxPrice handles large result sets

### 8.2 Special Characters

- ✅ Handles special characters in names and descriptions
- ✅ Handles unicode characters correctly
- ✅ Handles SQL injection attempts safely (parameterized queries)

### 8.3 Boundary Values

- ✅ Minimum name length (2 chars)
- ✅ Maximum name length (100 chars)
- ✅ Minimum description length (10 chars)
- ✅ Maximum description length (500 chars)
- ✅ Maximum price (999.99)
- ✅ Minimum price (> 0)

---

## Test File Organization Recommendation

```
src/__tests__/
├── menu.test.ts          (existing - GET /menu, GET /menu/:id)
├── menu-create.test.ts   (new - POST /menu)
├── menu-update.test.ts   (new - PATCH /menu/:id)
├── menu-delete.test.ts   (new - DELETE /menu/:id, DELETE /menu/:id/hard-delete)
├── menu-restore.test.ts  (new - POST /menu/:id/restore)
├── menu-queries.test.ts  (new - GET /menu/name/:coffeeName, GET /menu/price/:maxPrice, GET /menu/:id/description)
├── hours.test.ts         (new - GET /hours)
├── special.test.ts       (new - GET /special)
├── root.test.ts          (new - GET /)
├── error-handling.test.ts (new - 404, error middleware)
└── soft-delete.test.ts   (new - Integration tests for soft delete behavior)
```

---

## Priority Levels

### 🔴 High Priority (Core Functionality)

- POST /menu (create)
- PATCH /menu/:id (update)
- DELETE /menu/:id (soft delete)
- Soft delete behavior (items excluded from queries)
- Validation tests for all endpoints

### 🟡 Medium Priority (Important Features)

- GET /menu/:id/description
- GET /menu/name/:coffeeName
- GET /menu/price/:maxPrice
- POST /menu/:id/restore
- DELETE /menu/:id/hard-delete
- GET /hours
- GET /special

### 🟢 Low Priority (Edge Cases & Polish)

- Error middleware tests
- 404 handler tests
- Boundary value tests
- Special character handling
- Performance tests

---

## Test Coverage Goals

- **Line Coverage**: Target 90%+
- **Branch Coverage**: Target 85%+
- **Function Coverage**: Target 95%+
- **Statement Coverage**: Target 90%+

---

## Notes

1. **Soft Delete Testing**: Since soft delete is a core feature, ensure comprehensive integration tests that verify deleted items are excluded from all queries.

2. **Validation Testing**: All Zod schema validations should be thoroughly tested with both valid and invalid inputs.

3. **Case-Insensitive Matching**: Test that name matching works correctly across different case combinations.

4. **Database Mocking**: The existing mock-db setup is good. Ensure all tests use the test database and don't interfere with each other.

5. **Test Isolation**: Each test should be independent and not rely on state from other tests (already handled by beforeEach in setup.ts).
