/**
 * Merchandise selection keyed by `${packageId}::${lineId}` → selected qty.
 * Line-level shipping selection keyed by `${packageId}::${lineId}` → shipping units.
 * Amount = units × original per-unit shipping. Bulk select = merchandise only.
 */

export function selectionKey(packageId, lineId) {
  return `${packageId}::${lineId}`;
}

export function parseKey(key) {
  const [packageId, lineId] = key.split("::");
  return { packageId, lineId };
}

export function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Original per-unit shipping — never recalculated after refunds */
export function perUnitShipping(charge) {
  if (!charge || !charge.originalChargeableQty) return 0;
  return roundMoney(charge.originalCharge / charge.originalChargeableQty);
}

/** Package-attributable shipping from original per-unit × qty in package */
export function packageAttributableShipping(charge, qtyInPackage) {
  return roundMoney(perUnitShipping(charge) * qtyInPackage);
}

/** Remaining refundable shipping units on the line (from authoritative money balance) */
export function remainingShippingUnits(charge) {
  if (!charge) return 0;
  const perUnit = perUnitShipping(charge);
  if (perUnit <= 0) return 0;
  return Math.floor(roundMoney(charge.availableToRefund / perUnit) + Number.EPSILON);
}

/** Total selected merchandise qty for a line across all packages */
export function totalSelectedForLine(selections, lineId) {
  let total = 0;
  for (const [key, qty] of Object.entries(selections)) {
    if (parseKey(key).lineId === lineId) total += qty;
  }
  return total;
}

/** Total selected shipping units for a line across packages */
export function totalShippingUnitsSelectedForLine(shippingSelections, lineId) {
  let total = 0;
  for (const [key, units] of Object.entries(shippingSelections)) {
    if (parseKey(key).lineId === lineId) total += units;
  }
  return total;
}

/**
 * Max merchandise qty selectable for this allocation.
 */
export function maxSelectable({
  line,
  qtyInPackage,
  packageId,
  selections,
}) {
  const key = selectionKey(packageId, line.id);
  const current = selections[key] || 0;
  const others = totalSelectedForLine(selections, line.id) - current;
  const remainingOnLine = Math.max(0, line.availableToRefund - others);
  return Math.min(qtyInPackage, remainingOnLine);
}

/**
 * Max shipping units selectable for this package occurrence.
 * MIN(package qty, remaining line shipping units).
 */
export function maxShippingUnitsSelectable({
  charge,
  qtyInPackage,
  packageId,
  shippingSelections,
}) {
  if (!charge) return 0;
  const key = selectionKey(packageId, charge.lineId);
  const current = shippingSelections[key] || 0;
  const others = totalShippingUnitsSelectedForLine(shippingSelections, charge.lineId) - current;
  const remainingUnits = Math.max(0, remainingShippingUnits(charge) - others);
  return Math.min(qtyInPackage, remainingUnits);
}

export function setSelection(selections, packageId, lineId, qty, line, qtyInPackage) {
  const next = { ...selections };
  const key = selectionKey(packageId, lineId);
  const capped = Math.max(
    0,
    Math.min(qty, maxSelectable({ line, qtyInPackage, packageId, selections }))
  );
  if (capped === 0) delete next[key];
  else next[key] = capped;
  return next;
}

export function setShippingSelection(
  shippingSelections,
  packageId,
  charge,
  qtyInPackage,
  units
) {
  const next = { ...shippingSelections };
  const key = selectionKey(packageId, charge.lineId);
  const max = maxShippingUnitsSelectable({
    charge,
    qtyInPackage,
    packageId,
    shippingSelections,
  });
  const capped = Math.max(0, Math.min(Math.floor(Number(units) || 0), max));
  if (capped === 0) delete next[key];
  else next[key] = capped;
  return next;
}

/** Select package: fill merchandise only (shipping requires explicit selection) */
export function selectPackage(selections, pkg, lines) {
  let next = { ...selections };
  for (const alloc of pkg.allocations) {
    delete next[selectionKey(pkg.id, alloc.lineId)];
  }
  for (const alloc of pkg.allocations) {
    const line = lines[alloc.lineId];
    const max = maxSelectable({
      line,
      qtyInPackage: alloc.qtyInPackage,
      packageId: pkg.id,
      selections: next,
    });
    if (max > 0) next[selectionKey(pkg.id, alloc.lineId)] = max;
  }
  return next;
}

export function clearPackage(selections, pkg) {
  const next = { ...selections };
  for (const alloc of pkg.allocations) {
    delete next[selectionKey(pkg.id, alloc.lineId)];
  }
  return next;
}

/**
 * Package checkbox state — merchandise only.
 */
export function packageCheckState(selections, pkg, lines) {
  let anySelected = false;
  let allAtMax = true;

  for (const alloc of pkg.allocations) {
    const line = lines[alloc.lineId];
    const max = maxSelectable({
      line,
      qtyInPackage: alloc.qtyInPackage,
      packageId: pkg.id,
      selections,
    });
    const selected = selections[selectionKey(pkg.id, alloc.lineId)] || 0;
    if (selected > 0) anySelected = true;
    if (selected !== max) allAtMax = false;
  }

  if (!anySelected) return "none";
  if (allAtMax) return "all";
  return "partial";
}

export function isPackageFullySelected(selections, pkg, lines) {
  return packageCheckState(selections, pkg, lines) === "all";
}

export function packageHasAnySelection(selections, pkg) {
  return pkg.allocations.some(
    (a) => (selections[selectionKey(pkg.id, a.lineId)] || 0) > 0
  );
}

export function selectShipment(selections, shipment, lines) {
  let next = { ...selections };
  for (const pkg of shipment.packages) {
    next = clearPackage(next, pkg);
  }
  for (const pkg of shipment.packages) {
    next = selectPackage(next, pkg, lines);
  }
  return next;
}

export function clearShipment(selections, shipment) {
  let next = { ...selections };
  for (const pkg of shipment.packages) {
    next = clearPackage(next, pkg);
  }
  return next;
}

export function shipmentCheckState(selections, shipment, lines) {
  let anySelected = false;
  let allAtMax = true;

  for (const pkg of shipment.packages) {
    for (const alloc of pkg.allocations) {
      const line = lines[alloc.lineId];
      const max = maxSelectable({
        line,
        qtyInPackage: alloc.qtyInPackage,
        packageId: pkg.id,
        selections,
      });
      const selected = selections[selectionKey(pkg.id, alloc.lineId)] || 0;
      if (selected > 0) anySelected = true;
      if (selected !== max) allAtMax = false;
    }
  }

  if (!anySelected) return "none";
  if (allAtMax) return "all";
  return "partial";
}

export function shipmentHasAnySelection(selections, shipment) {
  return shipment.packages.some((pkg) => packageHasAnySelection(selections, pkg));
}

/**
 * Refund totals — merchandise and shipping kept separate.
 * shippingSelections values are units; amounts = units × per-unit.
 */
export function summarize(selections, lines, shippingSelections = {}, lineShipping = {}, orderShipping = null, orderShippingSelected = false) {
  let merchandiseCount = 0;
  let merchandiseValue = 0;
  const byLine = {};

  for (const [key, qty] of Object.entries(selections)) {
    if (!qty) continue;
    const { lineId, packageId } = parseKey(key);
    merchandiseCount += qty;
    merchandiseValue = roundMoney(merchandiseValue + qty * lines[lineId].unitPrice);
    if (!byLine[lineId]) byLine[lineId] = { qty: 0, packages: [] };
    byLine[lineId].qty += qty;
    byLine[lineId].packages.push({ packageId, qty });
  }

  let lineShippingValue = 0;
  const shippingByLine = {};
  for (const [key, units] of Object.entries(shippingSelections)) {
    if (!units) continue;
    const { lineId, packageId } = parseKey(key);
    const charge = lineShipping[lineId];
    if (!charge) continue;
    const amount = roundMoney(units * perUnitShipping(charge));
    lineShippingValue = roundMoney(lineShippingValue + amount);
    if (!shippingByLine[lineId]) shippingByLine[lineId] = { units: 0, amount: 0, packages: [] };
    shippingByLine[lineId].units += units;
    shippingByLine[lineId].amount = roundMoney(shippingByLine[lineId].amount + amount);
    shippingByLine[lineId].packages.push({ packageId, units, amount });
  }

  const orderShippingValue =
    orderShippingSelected && orderShipping ? orderShipping.availableToRefund : 0;

  const value = roundMoney(merchandiseValue + lineShippingValue + orderShippingValue);

  return {
    count: merchandiseCount,
    merchandiseCount,
    merchandiseValue,
    lineShippingValue,
    orderShippingValue,
    value,
    byLine,
    shippingByLine,
    hasSelection:
      merchandiseCount > 0 || lineShippingValue > 0 || orderShippingValue > 0,
  };
}
