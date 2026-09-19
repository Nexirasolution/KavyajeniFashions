# Lakshmibala Clothing Store — Full E-commerce Platform

A complete, mobile-responsive e-commerce site built with **Next.js 14 (App Router)** and **MongoDB**, themed in your LB Clothing pink/green palette. Includes a customer storefront and a full admin dashboard.

## What's included

**Storefront**
- Home page: banner carousel, bestsellers/top sellers/new arrivals carousels, combo offers, reviews, Shop by Reels
- Navbar with search bar + rounded category icons
- Category pages with **size filter** and sorting
- Product page with **color swatches (separate images per color)** and **size selector** with live stock
- Cart, checkout (Razorpay online payment + Cash on Delivery), coupon codes
- Order success page, printable **Invoice** and **Courier shipping label**
- SEO: dynamic metadata, sitemap.xml, robots.txt

**Admin dashboard** (`/admin`)
- Login (JWT cookie auth)
- Dashboard: today/week/month sales, 14-day sales trend chart, pending orders, low stock alerts, top products
- Products: create/edit with multiple colour variants, per-colour images, per-size stock
- Categories, Combo offers, Banners, Shop by Reels, Reviews (approve/feature), Coupons
- Orders: status updates, courier/AWB tracking, view invoice & shipping label
- Inventory: quick stock editor across all products
- Sales Reports: daily/weekly/monthly + custom date range CSV export
- Store Settings: shipping fee, free shipping threshold, SEO, WhatsApp/Instagram links

Everything on the storefront (categories, banners, reels, products, reviews, coupons) is pulled live from MongoDB via the API routes in `app/api/*` — no hardcoded content.

## 1. Prerequisites

- Node.js 18+ installed
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster (cloud database)
- A [Razorpay](https://dashboard.razorpay.com/signup) account for online payments (optional — Cash on Delivery works without it)

## 2. Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment file and fill in your values
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI` — get this from Atlas: Database → Connect → Drivers → copy the connection string, replace `<password>`.
- `JWT_SECRET` — any long random string (e.g. generate with `openssl rand -hex 32`).
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` — from Razorpay Dashboard → Settings → API Keys. Leave as-is to test with Cash on Delivery only.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your first admin login (used only by the seed script below).

```bash
# 3. Create your admin account + default categories (from your category list) + store settings
npm run seed

# 4. Start the development server
npm run dev
```

Visit:
- Storefront: http://localhost:3000
- Admin: http://localhost:3000/admin/login (use the email/password from `.env`)

## 3. Adding your products

1. Go to `/admin/categories` — your 7 categories (Salwar Set, Rayon Umbrella Kurtis, Side Open Kurtis, Umbrella Kurtis, Nighties, Innerwear, 2 Piece Set) are already created by the seed script. Add a rounded image URL to each if you'd like icons in the navbar.
2. Go to `/admin/products` → **Add Product**. For each product:
   - Pick a category
   - Add one **variant per colour** — each variant has its own price, compare-at price, image URLs, and size/stock table
3. Go to `/admin/banners` to set your homepage carousel images.
4. Mark your best products as **Bestseller** / **Top Seller** / **Active Seller** in the product form — these populate the homepage rows automatically.

Product/banner/reel images: paste any public image URL (e.g. upload to [Cloudinary](https://cloudinary.com), [ImgBB](https://imgbb.com), or your own hosting, then paste the link). This keeps the app lightweight — no file upload server needed.

## 4. Payments

- **Razorpay** handles UPI, cards, netbanking. Once your keys are in `.env`, checkout will show "Pay Online".
- **Cash on Delivery** always works, no setup needed.
- An **Invoice** and **Courier shipping label** are auto-generated per order (printable / saveable as PDF via the browser's print dialog) — see `/invoice/[orderId]` and `/courier-bill/[orderId]`, also linked from the admin order page.

## 5. Deploying

The easiest option is [Vercel](https://vercel.com) (made by the creators of Next.js):

```bash
npm install -g vercel
vercel
```

Add the same environment variables from `.env` in the Vercel project settings, then redeploy. Make sure your MongoDB Atlas cluster allows connections from anywhere (Network Access → 0.0.0.0/0) or from Vercel's IPs.

## 6. Project structure

```
app/
  (shop)/        storefront pages (home, category, product, cart, checkout, invoice...)
  admin/         admin dashboard pages
  api/           all dynamic API routes (products, categories, orders, coupons, banners, reels, reviews, combos, payment, admin)
components/      shared UI (Navbar, ProductCard, carousels...) + components/admin (admin-only UI)
models/          Mongoose schemas (Product, Category, Order, Coupon, Banner, Reel, Review, Combo, Settings, Admin)
lib/             db connection, auth helpers, Razorpay helper, utils
scripts/seed.js  one-time setup script
```

## Notes & next steps

- This is a complete, working codebase — but for a production launch you should also: add image upload (Cloudinary widget) instead of pasting URLs, set up SMS/WhatsApp order notifications, and enable HTTPS + a custom domain.
- Stock is automatically deducted when an order is placed, and restored manually if you cancel an order (adjust in `/admin/inventory`).
- All admin API routes require the `lb_admin_token` cookie set on login — the `/admin/*` pages are protected by `middleware.js`.
