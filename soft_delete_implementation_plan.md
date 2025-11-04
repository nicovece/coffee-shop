Reviewing the codebase to understand the current delete implementation and data model.

[3 tools called]

Reviewing the schema and query patterns:

[3 tools called]

## Work Evaluation for Soft-Delete Implementation

### Current State Analysis

**Existing DELETE route:**

- Single route: `DELETE /menu/:id` (lines 510-551)
- Performs hard delete using `db.delete(menuItems).where(eq(menuItems.id, id)).run()`
- No soft-delete mechanism exists

**Database schema:**

- `menu_items` table has: `id`, `name`, `price`, `description`, `createdAt`, `updatedAt`
- No `deletedAt` or `isDeleted` field
- Using SQLite with Drizzle ORM

**Query coverage:**

- 6 GET routes query `menuItems`:
  - `GET /menu` - lists all items
  - `GET /menu/:id` - single item
  - `GET /menu/:id/description` - single item
  - `GET /menu/name/:coffeeName` - search by name
  - `GET /menu/price/:maxPrice` - filter by price
  - All queries use direct `.from(menuItems)` without filtering deleted items

---

### Work Required Breakdown

#### 1. Database Schema Changes (Medium effort)

**Tasks:**

- Add `deletedAt` field to `menu_items` schema (timestamp, nullable)
- Create migration using `drizzle-kit generate`
- Apply migration using `drizzle-kit migrate`
- Update seed script if needed (unlikely, but verify)

**Complexity:** Low-Medium  
**Estimated time:** 15-30 minutes  
**Risk:** Low (adding nullable column is safe)

**Considerations:**

- Use `deletedAt` (timestamp) vs `isDeleted` (boolean)
  - Timestamp provides audit trail and restore capability
  - Boolean is simpler but less informative
- Recommendation: Use `deletedAt` timestamp (nullable)

---

#### 2. Route Changes (Medium effort)

**Tasks:**

- Rename existing route: `DELETE /menu/:id` → `DELETE /menu/:id/hard` or `DELETE /menu/:id/force`
- Create new route: `DELETE /menu/:id` (soft delete)
- Optional: Add restore route: `POST /menu/:id/restore` or `PATCH /menu/:id/restore`

**Complexity:** Low-Medium  
**Estimated time:** 30-45 minutes

**Route naming options:**

- Option A: `/menu/:id` (soft delete), `/menu/:id/hard` (hard delete)
- Option B: `/menu/:id` (soft delete), `/menu/:id/force` (hard delete)
- Recommendation: Option A — `/hard` is more explicit

---

#### 3. Query Logic Updates (High effort)

**Tasks:**

- Update all 6 GET routes to exclude soft-deleted items
- Update PATCH route to prevent updating deleted items
- Update POST route (duplicate check) to exclude deleted items
- Update DELETE route (existence check) to handle soft-deleted items appropriately

**Complexity:** Medium-High  
**Estimated time:** 45-60 minutes

**Query patterns to update:**

```typescript
// Current pattern (all 6 GET routes):
db.select().from(menuItems).where(...)

// New pattern needed:
db.select().from(menuItems).where(
  and(
    eq(menuItems.id, id),
    isNull(menuItems.deletedAt)  // or: eq(menuItems.deletedAt, null)
  )
)
```

**Affected routes:**

1. `GET /menu` - line 301
2. `GET /menu/:id` - line 291
3. `GET /menu/:id/description` - line 262
4. `GET /menu/name/:coffeeName` - line 205
5. `GET /menu/price/:maxPrice` - line 236
6. `PATCH /menu/:id` - line 371 (existence check)
7. `POST /menu` - line 450 (duplicate check)

**Complexity factors:**

- Need to import `isNull` or `and` from drizzle-orm
- Must update every query consistently
- Risk of missing one query (would show deleted items)

---

#### 4. Soft Delete Implementation (Low effort)

**Tasks:**

- Implement soft delete logic (update `deletedAt` instead of delete)
- Handle edge cases (already deleted, not found)
- Return appropriate response

**Complexity:** Low  
**Estimated time:** 15-20 minutes

**Logic:**

- Check if item exists and is not already soft-deleted
- Set `deletedAt = new Date()` instead of `db.delete()`
- Return success response

---

#### 5. Hard Delete Implementation (Low effort)

**Tasks:**

- Move existing delete logic to new route
- Rename route appropriately
- Keep same validation/error handling

**Complexity:** Low  
**Estimated time:** 10-15 minutes

---

#### 6. Optional: Restore Route (Low-Medium effort)

**Tasks:**

- Create restore endpoint
- Clear `deletedAt` field
- Validate item exists and is deleted
- Return restored item

**Complexity:** Low-Medium  
**Estimated time:** 20-30 minutes  
**Recommendation:** Include this for completeness

---

#### 7. Testing Considerations (High effort, but important)

**Tasks:**

- Test soft delete doesn't appear in GET routes
- Test hard delete still works
- Test restore functionality (if implemented)
- Test edge cases (delete already deleted, restore non-deleted, etc.)

**Complexity:** Medium-High  
**Estimated time:** 30-60 minutes (if test suite exists)

---

### Summary

| Component                | Effort      | Time Estimate | Risk   |
| ------------------------ | ----------- | ------------- | ------ |
| Database Schema          | Low-Medium  | 15-30 min     | Low    |
| Route Changes            | Low-Medium  | 30-45 min     | Low    |
| Query Updates            | Medium-High | 45-60 min     | Medium |
| Soft Delete Logic        | Low         | 15-20 min     | Low    |
| Hard Delete Rename       | Low         | 10-15 min     | Low    |
| Restore Route (optional) | Low-Medium  | 20-30 min     | Low    |
| Testing                  | Medium-High | 30-60 min     | Medium |

**Total Estimated Time:**

- **Minimum (without restore):** 2-3 hours
- **Complete (with restore):** 2.5-4 hours
- **With thorough testing:** 3.5-5 hours

---

### Key Challenges

1. Query consistency: All 7 query locations must exclude soft-deleted items
2. Import management: Need to add `isNull` and possibly `and` from drizzle-orm
3. Edge case handling: Already-deleted items, restore scenarios
4. Testing coverage: Ensure no deleted items leak through

### Recommendations

1. Start with database migration
2. Create helper function for "not deleted" filter to ensure consistency:
   ```typescript
   const notDeleted = isNull(menuItems.deletedAt);
   ```
3. Update all queries systematically (checklist approach)
4. Implement restore route for completeness
5. Consider adding a GET route to view deleted items (admin functionality)

### Risk Assessment

- **Low risk:** Database migration (nullable column)
- **Medium risk:** Missing a query update (would show deleted items)
- **Low risk:** Route implementation (straightforward logic)

Overall, this is a medium-complexity feature that requires careful attention to query updates but is very achievable with the current codebase structure.
