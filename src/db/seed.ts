import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { menuItems, hours, special } from './schema';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create a new database connection for seeding
  const sqlite = new Database('./data.db');
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });

  try {
    // Clear existing data (optional, useful for re-seeding)
    await db.delete(menuItems);
    await db.delete(hours);
    await db.delete(special);

    // Insert menu items
    await db.insert(menuItems).values([
      {
        name: 'Espresso',
        price: 2.5,
        description: 'Strong and bold coffee shot',
      },
      {
        name: 'Latte',
        price: 3.5,
        description: 'Smooth espresso with steamed milk',
      },
      {
        name: 'Cappuccino',
        price: 3.75,
        description: 'Espresso with foamed milk and cocoa powder',
      },
    ]);

    // Insert store hours
    await db.insert(hours).values({
      monday: '6am - 8pm',
      tuesday: '6am - 8pm',
      wednesday: '6am - 8pm',
      thursday: '6am - 8pm',
      friday: '6am - 9pm',
      saturday: '7am - 9pm',
      sunday: '7am - 7pm',
    });

    // Insert daily special
    await db.insert(special).values({
      name: 'Mocha Madness',
      price: 4.0,
      description: 'Chocolate espresso with whipped cream',
      is_active: true,
    });

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    sqlite.close();
  }
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
