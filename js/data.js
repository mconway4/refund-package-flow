/**
 * Sample order matching the PRD UNO scenario.
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
  "Customer request",
];

/** Authoritative line-level refund ledger */
export const lines = {
  "123": {
    id: "123",
    name: "UNO Card Game",
    sku: "111014050",
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
 * Fulfilment structure: Shipment → Package → line allocations.
 * qtyInPackage is physical only — never treated as refund balance.
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
        tracking: "AU123456", // same tracking, separate package record
        status: "Delivered",
        allocations: [{ lineId: "123", qtyInPackage: 2 }],
      },
    ],
  },
  {
    id: "ship-mel",
    label: "Shipment 2 — Melbourne DC",
    status: "Delivered",
    packages: [
      {
        id: "pkg-3",
        label: "Package 3",
        tracking: "AU987654",
        status: "Delivered",
        allocations: [{ lineId: "123", qtyInPackage: 2 }],
      },
    ],
  },
];
