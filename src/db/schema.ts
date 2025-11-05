import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

export const menuItems = sqliteTable('menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  price: real('price').notNull(),
  description: text('description').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const hours = sqliteTable('store_hours', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  monday: text('monday').notNull(),
  tuesday: text('tuesday').notNull(),
  wednesday: text('wednesday').notNull(),
  thursday: text('thursday').notNull(),
  friday: text('friday').notNull(),
  saturday: text('saturday').notNull(),
  sunday: text('sunday').notNull(),
});

export const special = sqliteTable('daily_special', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: real('price').notNull(),
  description: text('description').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  valid_from: integer('valid_from', { mode: 'timestamp' }),
  valid_to: integer('valid_to', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;

export type StoreHours = typeof hours.$inferSelect;
export type NewStoreHours = typeof hours.$inferInsert;

export type DailySpecial = typeof special.$inferSelect;
export type NewDailySpecial = typeof special.$inferInsert;
