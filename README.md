# Court Computer Hardware

A local-only demo e-commerce app for a computer hardware store. The project shows a customer shopping flow, an admin stock management view, order processing, and a simple order history screen.

## Project purpose
This prototype demonstrates how a small store can:
- display products in a shop grid
- let a customer add products to a cart
- place a fake order with a card form
- reduce stock automatically after purchase
- save products and orders in localStorage
- show recent order history in the admin view

## Tech used
- React + Vite
- JavaScript
- localStorage for persistence
- CSS for the store UI

## Run the project
```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Demo script (2 minutes)

### 1. Show the customer shopping experience
"This is the customer view of the Court Computer Hardware shop. We have a product catalog with laptops, accessories, monitors, and hardware items. Each item shows the name, description, price, and stock level."

- Open the app in the browser.
- Point to a few product cards.
- Explain that the big selling point is that stock is tracked in real time.

### 2. Add products to cart
"Let me add a few items to the cart. The cart updates the product count and total in real time."

- Click Add to Cart on 2–3 products.
- Increase or decrease a product quantity if needed.
- Show the running total.

### 3. Place the order
"When the customer clicks Place Order, a fake payment form opens. This is a local-only demo, so it behaves like a payment flow without connecting to a real payment provider."

- Click Place Order.
- Fill in the card form with sample data.
- Click Confirm.

### 4. Show the stock update
"The most important business logic is that stock automatically decreases after a purchase."

- Switch to Admin View.
- Show the stock table.
- Explain that the products purchased now have lower stock counts.

### 5. Show the order history
"The owner can also view order history in the admin panel. Each order includes the date, item breakdown, quantity, and total amount."

- Scroll to the Order History section.
- Show the recent order.
- Point out that the order list is saved locally and persists after refresh.

### 6. Explain persistence and reset
"Because this is a local demo, products and orders are stored in browser localStorage. The Reset Demo Data button restores the default product list and clears orders."

- Click Reset Demo Data.
- Mention that this helps with demo resets.

## Demo flow summary
The full flow is:
1. Browse products
2. Add to cart
3. Place an order
4. Switch to admin
5. Confirm stock decreased
6. Review order history

## Notes
- This is a local-only prototype.
- No backend or real payment service is connected.
- The app is meant to demonstrate the user flow and business logic clearly.
- If you later upgrade to Supabase, the same UI can be connected to a real database.

## Resetting the demo
If you want to restore the seed data:
- open the Admin View
- click Reset Demo Data

This clears the current orders and restores the original product list and stock values.

