# Coffee Shop API - Learning Roadmap

## 🎯 Goal

Transform from junior → mid-level developer by building a production-ready API

## ✅ Completed

- [x] Project setup with TypeScript + Express
- [x] Zod validation with factory pattern
- [x] SQLite + Drizzle ORM integration
- [x] Database schema design (3 tables)
- [x] Migrations system
- [x] Seed script
- [x] All GET routes converted to database queries
- [x] POST route with database insert

## 📋 Learning Path: A → D → C → B

---

## 🔹 STEP A: Complete CRUD Operations

**Time estimate:** 1-2 hours  
**Portfolio impact:** ⭐⭐⭐

### What You'll Learn

- HTTP method semantics (PUT vs PATCH)
- Idempotency concepts
- Database UPDATE and DELETE operations
- Handling partial updates
- Optimistic concurrency (timestamps)

### Routes to Implement

```
PATCH /menu/:id     - Update menu item (partial)
PUT /menu/:id       - Replace menu item (full)
DELETE /menu/:id    - Delete menu item
```

### Key Concepts

- **PUT**: Replace entire resource (all fields required)
- **PATCH**: Update specific fields (partial allowed)
- **DELETE**: Remove resource (consider soft deletes)
- **Idempotency**: Same request = same result (important for PUT/DELETE)

### Success Criteria

- [ ] Can update menu item price
- [ ] Can update menu item name (with validation)
- [ ] Can delete menu item
- [ ] Proper error handling (404 for non-existent items)
- [ ] Validation works on updates
- [ ] UpdatedAt timestamp changes automatically

---

## 🔹 STEP D: Add Tests

**Time estimate:** 2-3 hours  
**Portfolio impact:** ⭐⭐⭐⭐⭐

### What You'll Learn

- Test-driven development (TDD)
- Unit vs integration testing
- Test fixtures and factories
- Mocking databases
- Test coverage reporting
- CI/CD basics

### Testing Strategy

```
Unit Tests:
- Zod schema validation
- Helper functions
- Utility functions

Integration Tests:
- Route handlers (full request/response cycle)
- Database operations
- Error scenarios
```

### Tools to Use

- **Vitest** (modern, fast, TypeScript-native)
- **Supertest** (HTTP assertions)
- **@faker-js/faker** (generate test data)

### Success Criteria

- [ ] Test suite runs with `pnpm test`
- [ ] Tests for all CRUD operations
- [ ] Tests for validation failures
- [ ] Tests for edge cases (404, duplicates, etc.)
- [ ] At least 80% code coverage
- [ ] Tests run in CI pipeline (GitHub Actions)

---

## 🔹 STEP C: Add Authentication

**Time estimate:** 4-6 hours  
**Portfolio impact:** ⭐⭐⭐⭐⭐

### What You'll Learn

- Password hashing (bcrypt)
- JWT (JSON Web Tokens)
- Authentication middleware
- Protected routes
- Security best practices
- Token refresh patterns

### Features to Implement

```
POST /auth/register  - Create user account
POST /auth/login     - Get JWT token
GET /auth/me         - Get current user info
POST /menu           - Now requires authentication
PATCH /menu/:id      - Now requires authentication
DELETE /menu/:id     - Now requires authentication
```

### Database Changes

```typescript
// New table: users
users
├── id (integer, primary key)
├── email (text, unique, required)
├── password_hash (text, required)
├── name (text, required)
├── role (text, default: 'user') // 'user' or 'admin'
├── created_at (timestamp)
└── updated_at (timestamp)
```

### Security Checklist

- [ ] Passwords never stored in plain text
- [ ] Use bcrypt with salt rounds ≥ 10
- [ ] JWT secrets stored in environment variables
- [ ] Token expiration (1h access token)
- [ ] Refresh token pattern (optional)
- [ ] Rate limiting on auth endpoints
- [ ] Input sanitization

### Success Criteria

- [ ] Users can register with email/password
- [ ] Users can login and receive JWT
- [ ] Protected routes return 401 without token
- [ ] Protected routes work with valid token
- [ ] Tokens expire after 1 hour
- [ ] Tests cover auth flows

---

## 🔹 STEP B: Add Relationships (Categories)

**Time estimate:** 3-4 hours  
**Portfolio impact:** ⭐⭐⭐⭐

### What You'll Learn

- Foreign key constraints
- Database relationships (1:many)
- JOIN queries in Drizzle
- Cascade deletes
- Data integrity
- Relational database design

### Database Changes

```typescript
// New table: categories
categories
├── id (integer, primary key)
├── name (text, unique, required)
├── description (text)
├── created_at (timestamp)
└── updated_at (timestamp)

// Modified table: menu_items
menu_items
├── ... (existing fields)
└── category_id (integer, foreign key → categories.id)
```

### Features to Implement

```
GET /categories           - List all categories
POST /categories          - Create category (admin only)
GET /categories/:id/items - Get all items in category
GET /menu?category=:id    - Filter menu by category
```

### Query Examples

```typescript
// Get menu item with category
db.select()
  .from(menuItems)
  .leftJoin(categories, eq(menuItems.categoryId, categories.id))
  .where(eq(menuItems.id, 1));

// Get category with all its items
db.select()
  .from(categories)
  .leftJoin(menuItems, eq(categories.id, menuItems.categoryId))
  .where(eq(categories.id, 1));
```

### Success Criteria

- [ ] Categories table created with migration
- [ ] menu_items has category_id foreign key
- [ ] Can create/read categories
- [ ] Can assign category to menu item
- [ ] JOIN queries work correctly
- [ ] Cascade delete: deleting category updates menu items
- [ ] Tests for relationship queries

---

## 🎓 Additional Enhancements (Optional)

### Error Handling & Logging

- [ ] Centralized error handler
- [ ] Winston or Pino logger
- [ ] Request ID tracking
- [ ] Error monitoring (Sentry)

### API Documentation

- [ ] OpenAPI/Swagger spec
- [ ] Interactive API docs
- [ ] Request/response examples
- [ ] Postman collection

### Performance Optimization

- [ ] Database indexes
- [ ] Query optimization
- [ ] Response caching
- [ ] Compression middleware

### DevOps

- [ ] Docker containerization
- [ ] docker-compose for development
- [ ] Environment-based config
- [ ] CI/CD pipeline
- [ ] Deploy to Railway/Render/Fly.io

---

## 📊 Portfolio Presentation Tips

### README.md Should Include:

1. **Project overview** - What it does, tech stack
2. **Features list** - Bullet points of capabilities
3. **Architecture diagram** - Simple visual of structure
4. **API documentation** - Endpoint list with examples
5. **Setup instructions** - How to run locally
6. **Testing** - How to run tests, coverage badge
7. **Live demo** - Deployed URL if possible
8. **What you learned** - Technical decisions and why

### Code Quality Signals:

- ✅ Consistent code formatting (Prettier)
- ✅ Linting (ESLint)
- ✅ Type safety (no `any` types)
- ✅ Meaningful commit messages
- ✅ Branch strategy (main, develop, feature branches)
- ✅ PR descriptions (even if solo project)

### Recruiter-Friendly Features:

- ✅ Can run with one command (`npm install && npm run dev`)
- ✅ Includes seed data
- ✅ Has tests that pass
- ✅ Environment variables documented
- ✅ Clear error messages
- ✅ Postman collection or curl examples

---

## 🎯 Timeline Estimate

| Step                   | Time | Cumulative |
| ---------------------- | ---- | ---------- |
| A: Complete CRUD       | 1-2h | 2h         |
| D: Add Tests           | 2-3h | 5h         |
| C: Add Authentication  | 4-6h | 11h        |
| B: Add Relationships   | 3-4h | 15h        |
| Documentation & Polish | 2-3h | 18h        |

**Total: ~15-18 hours** to transform this into a mid-level portfolio project.

---

## 🚀 You're Here →

**Current Status:** Completed basic CRUD (Create + Read)  
**Next Step:** Step A - Complete CRUD (Update + Delete)  
**Progress:** ~40% complete

Let's keep building! 💪
