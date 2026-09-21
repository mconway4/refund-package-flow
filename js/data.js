/**
 * Sample order: trampoline Big & Bulky (one unit per B&B package) + Crayola companion.
 * Line ID owns refund balance. Package/shipment owns fulfilment context only.
 */

export const orderMeta = {
  store: "Sold by Kmart",
  orderedAt: "Ordered May 20, 2026",
  status: "Shipped",
};

export const reasons = [
  "Please select the reason",
  "Damaged",
  "Missing / not received",
  "Incorrect item",
  "Delivery delay",
  "Delivery issue",
  "Customer request",
];

/** Authoritative line-level merchandise refund ledger */
export const lines = {
  "123": {
    id: "123",
    name: "14ft Trampoline with Enclosure",
    sku: "111014050",
    unitPrice: 260.0,
    ordered: 3,
    delivered: 3,
    inProgress: 0,
    cancelled: 0,
    refunded: 0,
    availableToRefund: 3,
    status: "Shipped",
  },
  "456": {
    id: "456",
    name: "Crayola Crayons 24pk",
    sku: "111014051",
    unitPrice: 4.5,
    ordered: 2,
    delivered: 2,
    inProgress: 0,
    cancelled: 0,
    refunded: 0,
    availableToRefund: 2,
    status: "Shipped",
  },
};

/**
 * Line-level shipping charges (e.g. Big & Bulky).
 * Balance is authoritative at line level — never inferred per package.
 * Per-unit = originalCharge ÷ originalChargeableQty (never recalculated after refunds).
 * B&B ships one unit per package, so each package shows one attributable charge.
 */
export const lineShipping = {
  "123": {
    id: "bnb-123",
    lineId: "123",
    name: "Big & Bulky shipping",
    originalCharge: 45.0,
    originalChargeableQty: 3,
    previouslyRefunded: 15.0,
    availableToRefund: 30.0,
  },
};

/**
 * Order-level shipping (whole order) — independent of line-level B&B.
 */
export const orderShipping = {
  id: "order-ship-1",
  name: "Standard shipping",
  originalCharge: 12.0,
  previouslyRefunded: 0,
  availableToRefund: 12.0,
};

/**
 * Fulfilment: each Big & Bulky unit in its own package.
 * $15 of B&B already refunded at line level with no package attribution → $30 remaining.
 */
export const shipments = [
  {
    id: "ship-syd",
    label: "Shipment 1 — Sydney DC",
    status: "Delivered",
    packages: [
      {
        id: "pkg-1",
        label: "Package 1",
        tracking: "AU123456",
        status: "Delivered",
        allocations: [
          { lineId: "123", qtyInPackage: 1 },
          { lineId: "456", qtyInPackage: 2 },
        ],
      },
      {
        id: "pkg-2",
        label: "Package 2",
        tracking: "AU123457",
        status: "Delivered",
        allocations: [{ lineId: "123", qtyInPackage: 1 }],
      },
      {
        id: "pkg-3",
        label: "Package 3",
        tracking: "AU123458",
        status: "Delivered",
        allocations: [{ lineId: "123", qtyInPackage: 1 }],
      },
    ],
  },
];
