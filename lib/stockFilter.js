// Location: lib/stockFilter.js

// Customer-facing product queries should spread this into their filter:
//
//   const query = { isActive: true, ...inStockFilter() };
//
// A product is shown when at least one size of at least one variant has
// stock > 0. Products with no variants at all (nothing to track stock on)
// are treated as in stock, so they never disappear by accident.
//
// It returns a fresh object each time because Mongoose may mutate query
// objects while casting them.
export function inStockFilter() {
  return {
    $or: [
      { 'variants.sizes.stock': { $gt: 0 } },
      { variants: { $exists: false } },
      { variants: { $size: 0 } },
    ],
  };
}