# Motocross Bike Inventory Demo

A small local web application for managing a motocross bike dealership's inventory. The app starts with 20 sample bikes and lets you view bikes, add new ones, update quantities, and delete bikes.

## Tech stack

- Node.js 20+
- Vanilla HTML, CSS, and JavaScript
- In-memory data store seeded on server start

## Run locally

1. Open a terminal in `/home/runner/work/anothertest/anothertest`
2. Start the app:

   ```bash
   npm start
   ```

3. Open `http://localhost:3000`

## Test the app

Run the focused API tests:

```bash
npm test
```

Then verify the main features in the browser:

- Review the seeded motocross bike list
- Add a new bike with the form
- Change a bike quantity and save it
- Delete a bike

## Notes

- The inventory is stored in memory for simplicity.
- Restarting the server resets the sample motocross bike data.
