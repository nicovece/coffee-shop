const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

const PORT = 8080;

// Load data from JSON file
const dataPath = path.join(__dirname, "data.json");
let data;

try {
  const fileContent = fs.readFileSync(dataPath, "utf8");
  data = JSON.parse(fileContent);
} catch (error) {
  console.error("Error reading data.json:", error.message);
  process.exit(1);
}

// Extract data from the loaded JSON
const menu = data.menu;
const hours = data.hours;
const special = data.special;

app.use((req, res, next) => {
  const current_date = new Date().toISOString();
  console.log(`[${current_date}] ${req.method} ${req.url}`);
  next();
});

// GET routes

app.get("/", (req, res) => {
  res.send("Welcome to the Coffee Shop");
});

app.get("/menu/name/:coffeeName", (req, res) => {
  const coffeeName = req.params.coffeeName.trim();

  // Just validate it's not empty
  if (!coffeeName) {
    return res.status(400).json({ error: "Coffee name cannot be empty" });
  }

  // Case-insensitive search
  const item = menu.find(
    (i) => i.name.toLowerCase() === coffeeName.toLowerCase(),
  );

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  res.json(item);
});

app.get("/menu/price/:maxPrice", (req, res) => {
  if (!/^\d+(\.\d+)?$/.test(req.params.maxPrice)) {
    return res.status(400).json({ error: "Invalid max price format" });
  }
  const maxPrice = parseFloat(req.params.maxPrice);
  if (isNaN(maxPrice)) {
    return res.status(400).json({ error: "Invalid max price format" });
  }
  if (maxPrice < 0) {
    return res.status(400).json({ error: "Max price must be positive" });
  }
  const items = menu.filter((item) => item.price <= maxPrice);
  res.json(items);
});

app.get("/menu/:id/description", (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  const id = parseInt(req.params.id);
  const item = menu.find((item) => item.id === id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  const formattedPrice = item.price.toFixed(2);
  const formattedDescription = `${item.name} - ${item.description}. Only $${formattedPrice}!`;
  res.json({ description: formattedDescription });
});

app.get("/menu/:id", (req, res) => {
  // Validate that the ID is entirely numeric using regex
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  const id = parseInt(req.params.id);
  const item = menu.find((item) => item.id === id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json(item);
});

app.get("/menu", (req, res) => {
  res.json(menu);
});

app.get("/hours", (req, res) => {
  res.json(hours);
});

app.get("/special", (req, res) => {
  res.json(special);
});

// POST routes

// 1. Add body parser middleware (BEFORE routes!)
app.use(express.json());

// 2. Create POST endpoint
app.post("/menu", (req, res) => {
  // 3. Extract data from body
  const { name, price, description } = req.body;

  // 4. Validate required fields
  if (!name) {
    return res.status(400).json({
      error: "Missing required field: name",
    });
  }

  if (price === undefined) {
    return res.status(400).json({
      error: "Missing required field: price",
    });
  }

  if (!description) {
    return res.status(400).json({
      error: "Missing required field: description",
    });
  }

  // 5. Validate data types
  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      error: "Name must be a non-empty string",
    });
  }

  if (typeof price !== "number" || price <= 0) {
    return res.status(400).json({
      error: "Price must be a positive number",
    });
  }

  if (typeof description !== "string") {
    return res.status(400).json({
      error: "Description must be a string",
    });
  }

  // 6. Check for duplicates (optional)
  const exists = menu.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) {
    return res.status(409).json({
      error: "Coffee with this name already exists",
    });
  }

  // 7. Generate new ID
  const newId =
    menu.length > 0 ? Math.max(...menu.map((item) => item.id)) + 1 : 1;

  // 8. Create new item
  const newItem = {
    id: newId,
    name: name.trim(),
    price: price,
    description: description.trim(),
  };

  // 9. Add to menu
  menu.push(newItem);

  // 10. Send success response with new item
  res.status(201).json(newItem);
});

// 1. Add a 404 handler at the end (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// 2. Could add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
