/**
 * Selection keyed by `${packageId}::${lineId}` → selected qty.
 * Enforces package qty max + shared line-level availableToRefund.
 */

export function selectionKey(packageId, lineId) {
  return `${packageId}::${lineId}`;
}

export function parseKey(key) {
  const [packageId, lineId] = key.split("::");
  return { packageId, lineId };
}

/** Total selected for a line across all packages */
export function totalSelectedForLine(selections, lineId) {
  let total = 0;
  for (const [key, qty] of Object.entries(selections)) {
    if (parseKey(key).lineId === lineId) total += qty;
  }
  return total;
}

/**
 * Max qty that can still be selected for this allocation,
 * given current selections (excluding this cell's current value when computing remaining).
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

/** Select package: fill each allocation to max eligible under line balances */
export function selectPackage(selections, pkg, lines) {
  let next = { ...selections };
  // Clear package first so we redistribute fairly within package
  for (const alloc of pkg.allocations) {
    const key = selectionKey(pkg.id, alloc.lineId);
    delete next[key];
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
 * Package checkbox state against currently refundable qty (not physical units):
 * - none: nothing selected
 * - partial: some eligible qty selected, but not every allocation at its max
 * - all: every allocation is at its maxSelectable (max may be < qty in package)
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

/** Select shipment: fill each package to max eligible under line balances (in order) */
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

export function summarize(selections, lines) {
  let count = 0;
  let value = 0;
  const byLine = {};
  for (const [key, qty] of Object.entries(selections)) {
    if (!qty) continue;
    const { lineId, packageId } = parseKey(key);
    count += qty;
    value += qty * lines[lineId].unitPrice;
    if (!byLine[lineId]) byLine[lineId] = { qty: 0, packages: [] };
    byLine[lineId].qty += qty;
    byLine[lineId].packages.push({ packageId, qty });
  }
  return { count, value, byLine };
}
