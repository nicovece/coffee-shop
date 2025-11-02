// Type definitions for our data structures
// This makes the code self-documenting and type-safe

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string;
}

export interface Hours {
  weekdays: string;
  weekends: string;
}

export interface Special {
  name: string;
  price: number;
  description: string;
}

export interface CoffeeShopData {
  menu: MenuItem[];
  hours: Hours;
  special: Special;
}

// Type for creating a new menu item (without id, since we generate it)
export type CreateMenuItemInput = Omit<MenuItem, 'id'>;
