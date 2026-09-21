/**
 * Combined demo order:
 * - Trampoline + Big & Bulky shipping (partial fee refunds, shared line balance)
 * - UNO across packages (merchandise qty line-level limiter)
 * Spread across Sydney DC, Melbourne DC, and Burwood store.
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
  "789": {
    id: "789",
    name: "UNO Card Game",
    sku: "111014052",
    unitPrice: 7.0,
    ordered: 5,
    delivered: 5,
    inProgress: 0,
    cancelled: 0,
    refunded: 1,
    availableToRefund: 4,
    status: "Partially Returned",
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
 * Line-level shipping — trampoline Big & Bulky only.
 * $15 previously refunded at line level (no package attribution) → $30 remaining.
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
 * Fulfilment across three origins.
 * B&B: one trampoline per package ($15 attributable each).
 * UNO: 1 + 2 + 2 = 5 physical units; only 4 remaining refundable at line level.
 */
export const shipments = [
  {
    id: "ship-syd",
    label: "Shipment 1 — Sydney DC",
    status: "Delivered",
    packages: [
      {
        id: "pkg-syd-1",
        label: "Package 1",
        tracking: "AU123456",
        status: "Delivered",
        allocations: [
          { lineId: "123", qtyInPackage: 1 },
          { lineId: "456", qtyInPackage: 2 },
        ],
      },
      {
        id: "pkg-syd-2",
        label: "Package 2",
        tracking: "AU123456",
        status: "Delivered",
        allocations: [{ lineId: "789", qtyInPackage: 1 }],
      },
    ],
  },
  {
    id: "ship-mel",
    label: "Shipment 2 — Melbourne DC",
    status: "Delivered",
    packages: [
      {
        id: "pkg-mel-1",
        label: "Package 1",
        tracking: "AU987654",
        status: "Delivered",
        allocations: [{ lineId: "123", qtyInPackage: 1 }],
      },
      {
        id: "pkg-mel-2",
        label: "Package 2",
        tracking: "AU987654",
        status: "Delivered",
        allocations: [{ lineId: "789", qtyInPackage: 2 }],
      },
    ],
  },
  {
    id: "ship-burwood",
    label: "Shipment 3 — Burwood store",
    status: "Delivered",
    packages: [
      {
        id: "pkg-bur-1",
        label: "Package 1",
        tracking: "AU555001",
        status: "Delivered",
        allocations: [{ lineId: "123", qtyInPackage: 1 }],
      },
      {
        id: "pkg-bur-2",
        label: "Package 2",
        tracking: "AU555002",
        status: "Delivered",
        allocations: [{ lineId: "789", qtyInPackage: 2 }],
      },
    ],
  },
];
