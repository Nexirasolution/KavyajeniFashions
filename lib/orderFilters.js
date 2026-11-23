// An order is "visible" (shown in Orders list + counted on the dashboard) if:
//  - it was paid online, or
//  - it's a COD order (no prepayment is needed, whatever its fee status).
export const VISIBLE_ORDER_FILTER = {
  $or: [
    { paymentStatus: { $in: ['paid', 'cod_fee_paid'] } },
    { paymentMethod: 'cod' },
  ],
};

// Orders in these statuses never brought in money (e.g. a COD parcel refused
// at the door), so they're left out of sales figures.
export const NON_REVENUE_STATUSES = ['cancelled', 'returned'];