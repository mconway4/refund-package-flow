import {
  orderMeta,
  reasons,
  lines,
  lineShipping,
  orderShipping,
  shipments,
} from "./data.js?v=13";
import {
  selectionKey,
  maxSelectable,
  setSelection,
  selectPackage,
  clearPackage,
  packageCheckState,
  selectShipment,
  clearShipment,
  shipmentCheckState,
  summarize,
  perUnitShipping,
  packageAttributableShipping,
  maxShippingSelectable,
  setShippingSelection,
} from "./selection.js?v=13";

const state = {
  selections: {},
  shippingSelections: {},
  itemReasons: {},
  shippingReasons: {},
  orderShippingSelected: false,
  orderShippingReason: "",
  orderReason: "",
  source: "Guide",
  notes: "",
  submitted: null,
};

const money = (n) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const truckSvg = `<svg class="ship-icon" width="16" height="16" viewBox="0 0 24 16" fill="none" aria-hidden="true"><path d="M1 4h14v9H1V4zm14 2h4l3 3v4h-7V6zM5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" stroke="currentColor" stroke-width="1.5"/></svg>`;

function shippingBalanceTip(charge) {
  const perUnit = perUnitShipping(charge);
  return `
    <span class="info-tip" tabindex="0" role="img" aria-label="Shipping balance details">
      <span class="info-i">ⓘ</span>
      <span class="info-tip-panel" role="tooltip">
        <strong>${charge.name}</strong>
        <span>Originally charged: ${money(charge.originalCharge)}<br/>
        Previously refunded: ${money(charge.previouslyRefunded)}<br/>
        Remaining to refund: ${money(charge.availableToRefund)}</span>
        <span style="display:block;margin-top:6px">${money(perUnit)} shipping was charged per unit. Previous refunds aren't linked to a specific package.</span>
      </span>
    </span>
  `;
}

function renderShippingRow(pkg, alloc) {
  const charge = lineShipping[alloc.lineId];
  if (!charge) return "";

  const key = selectionKey(pkg.id, alloc.lineId);
  const attributable = packageAttributableShipping(charge, alloc.qtyInPackage);
  const max = maxShippingSelectable({
    charge,
    qtyInPackage: alloc.qtyInPackage,
    packageId: pkg.id,
    shippingSelections: state.shippingSelections,
  });
  const selected = state.shippingSelections[key] || 0;
  const selectedOn = selected > 0;
  const limitedByBalance = max < attributable && max > 0;
  const exhausted = max === 0 && !selectedOn;
  const perUnit = perUnitShipping(charge);
  const reason = state.shippingReasons[key] || state.orderReason || "";

  const amountLabel =
    alloc.qtyInPackage === 1
      ? `${money(attributable)} for this unit`
      : `${money(attributable)} for ${alloc.qtyInPackage} units`;

  const perUnitNote =
    alloc.qtyInPackage > 1
      ? `<div class="ship-meta">${money(perUnit)} per unit</div>`
      : "";

  let priorShip = "";
  if (charge.previouslyRefunded > 0) {
    priorShip = `
      <div class="prior-refund">
        ${money(charge.previouslyRefunded)} previously refunded on this line
        ${shippingBalanceTip(charge)}
      </div>`;
  }

  let constraint = "";
  if (exhausted) {
    constraint = `
      <div class="constraint warn">
        No shipping amount remaining to refund
        ${shippingBalanceTip(charge)}
      </div>`;
  } else if (limitedByBalance) {
    constraint = `
      <div class="constraint warn">
        Only ${money(max)} remaining to refund
        ${shippingBalanceTip(charge)}
      </div>`;
  }

  return `
    <tr class="ship-row ${exhausted ? "exhausted" : ""}" data-pkg="${pkg.id}" data-line="${alloc.lineId}" data-ship-row="1">
      <td></td>
      <td colspan="3">
        <div class="ship-cell">
          <div class="ship-indent" aria-hidden="true">↳</div>
          <div class="ship-body">
            <div class="ship-name">${truckSvg} ${charge.name}</div>
            <div class="ship-amount">${amountLabel}</div>
            ${perUnitNote}
            ${priorShip}
            ${constraint}
            <label class="ship-refund-ctrl ${exhausted ? "is-disabled" : ""}">
              <input
                class="checkbox"
                type="checkbox"
                data-action="ship-fee-toggle"
                data-pkg="${pkg.id}"
                data-line="${alloc.lineId}"
                ${selectedOn ? "checked" : ""}
                ${exhausted ? "disabled" : ""}
                aria-label="Refund ${charge.name} for ${lines[alloc.lineId].name} in ${pkg.label}"
              />
              <span>${exhausted ? "Refund shipping" : `Refund ${money(selectedOn ? selected : max)} shipping`}</span>
            </label>
          </div>
        </div>
      </td>
      <td>
        <select class="select" data-action="ship-reason" data-pkg="${pkg.id}" data-line="${alloc.lineId}" ${selectedOn ? "" : "disabled"}>
          ${reasons
            .map(
              (r, i) =>
                `<option value="${i === 0 ? "" : r}" ${reason === r ? "selected" : ""}>${r}</option>`
            )
            .join("")}
        </select>
      </td>
      <td class="ship-price">${selectedOn ? money(selected) : "—"}</td>
      <td class="ship-subtotal muted-cell">—</td>
    </tr>
  `;
}

function renderAllocationRow(pkg, alloc) {
  const line = lines[alloc.lineId];
  const key = selectionKey(pkg.id, line.id);
  const selected = state.selections[key] || 0;
  const max = maxSelectable({
    line,
    qtyInPackage: alloc.qtyInPackage,
    packageId: pkg.id,
    selections: state.selections,
  });
  const limitedByBalance = max < alloc.qtyInPackage;
  const cannotSelect = max === 0;
  const reason = state.itemReasons[key] || state.orderReason || "";

  const options = Array.from({ length: max + 1 }, (_, i) => {
    return `<option value="${i}" ${i === selected ? "selected" : ""}>${i}</option>`;
  }).join("");

  const unitWord = line.ordered === 1 ? "unit" : "units";
  const hasHave = line.refunded === 1 ? "has" : "have";
  const priorRefund =
    line.refunded > 0
      ? `<div class="prior-refund">
          ${line.refunded} previously refunded
          <span class="info-tip" tabindex="0" role="img" aria-label="Previous refund details">
            <span class="info-i">ⓘ</span>
            <span class="info-tip-panel" role="tooltip">
              <strong>Previous refund</strong>
              <span>${line.refunded} of ${line.ordered} ${unitWord} on this product line ${hasHave} previously been refunded. Previous refunds aren't associated with a specific package.</span>
            </span>
          </span>
        </div>`
      : "";

  let qtyHint = "";
  if (cannotSelect) {
    qtyHint = `<div class="constraint warn">No quantity remaining to refund</div>`;
  } else if (limitedByBalance) {
    qtyHint = `<div class="qty-hint qty-hint-limit">
      Max ${max} · ${max} remaining
      <span class="info-tip" tabindex="0" role="img" aria-label="Refund limit details">
        <span class="info-i">ⓘ</span>
        <span class="info-tip-panel" role="tooltip">
          <strong>Refund limit</strong>
          <span>This product has ${alloc.qtyInPackage} ${alloc.qtyInPackage === 1 ? "unit" : "units"} in this package, but only ${max} ${max === 1 ? "is" : "are"} still available to refund across the order.</span>
        </span>
      </span>
    </div>`;
  } else {
    qtyHint = `<div class="qty-hint">Max ${alloc.qtyInPackage} in package</div>`;
  }

  return `
    <tr class="${cannotSelect ? "exhausted" : ""}" data-pkg="${pkg.id}" data-line="${line.id}">
      <td>
        <input
          class="checkbox"
          type="checkbox"
          data-action="item-toggle"
          data-pkg="${pkg.id}"
          data-line="${line.id}"
          ${selected > 0 ? "checked" : ""}
          ${cannotSelect && selected === 0 ? "disabled" : ""}
          aria-label="Select ${line.name} from ${pkg.label}"
        />
      </td>
      <td>
        <div class="item-cell">
          <div class="thumb">${line.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <div class="item-name">${line.name}</div>
            <div class="item-sku">SKU ${line.sku}</div>
            ${priorRefund}
          </div>
        </div>
      </td>
      <td>
        <span class="qty-in-pkg">${alloc.qtyInPackage}</span>
      </td>
      <td>
        <select class="select select-qty" data-action="qty" data-pkg="${pkg.id}" data-line="${line.id}" ${cannotSelect && selected === 0 ? "disabled" : ""}>
          ${options}
        </select>
        ${qtyHint}
      </td>
      <td>
        <select class="select" data-action="reason" data-pkg="${pkg.id}" data-line="${line.id}" ${selected === 0 ? "disabled" : ""}>
          ${reasons
            .map(
              (r, i) =>
                `<option value="${i === 0 ? "" : r}" ${reason === r ? "selected" : ""}>${r}</option>`
            )
            .join("")}
        </select>
      </td>
      <td>${money(line.unitPrice)}</td>
      <td>${money(line.unitPrice * selected)}</td>
    </tr>
    ${renderShippingRow(pkg, alloc)}
  `;
}

function renderPackage(pkg) {
  const itemCount = pkg.allocations.reduce((s, a) => s + a.qtyInPackage, 0);
  const checkState = packageCheckState(state.selections, pkg, lines);
  const checked = checkState === "all" ? "checked" : "";
  const ariaChecked =
    checkState === "partial" ? "mixed" : checkState === "all" ? "true" : "false";
  return `
    <section class="package" data-package="${pkg.id}">
      <div class="package-head">
        <div class="package-head-left">
          <input class="checkbox" type="checkbox" data-action="pkg-toggle" data-pkg="${pkg.id}" data-check-state="${checkState}" ${checked} aria-checked="${ariaChecked}" aria-label="Select package" />
          <span class="package-title">${pkg.label}</span>
          <span class="pkg-count">${itemCount} unit${itemCount === 1 ? "" : "s"} in package</span>
        </div>
        <span class="help">Select all refundable items in this package · shipping separate</span>
      </div>
      <table class="alloc-table">
        <thead>
          <tr>
            <th style="width:36px"></th>
            <th>Item</th>
            <th>In this package</th>
            <th>Select qty</th>
            <th>Reason</th>
            <th>Price</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${pkg.allocations.map((a) => renderAllocationRow(pkg, a)).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderOrderShipping() {
  if (!orderShipping) return "";
  const selected = state.orderShippingSelected;
  const reason = state.orderShippingReason || state.orderReason || "";
  const canSelect = orderShipping.availableToRefund > 0;
  return `
    <div class="card order-shipping-card">
      <div class="order-ship-row">
        <input
          class="checkbox"
          type="checkbox"
          data-action="order-ship-toggle"
          ${selected ? "checked" : ""}
          ${canSelect ? "" : "disabled"}
          aria-label="Refund order-level ${orderShipping.name}"
        />
        <div class="order-ship-body">
          <div class="ship-name">${truckSvg} Order-level shipping fee</div>
          <div class="item-name">${orderShipping.name}</div>
          <div class="ship-amount">${money(orderShipping.availableToRefund)} remaining</div>
          <p class="help" style="margin-top:4px">Applies to the whole order — independent of line-level Big &amp; Bulky.</p>
        </div>
        <select class="select order-ship-reason" data-action="order-ship-reason" ${selected ? "" : "disabled"}>
          ${reasons
            .map(
              (r, i) =>
                `<option value="${i === 0 ? "" : r}" ${reason === r ? "selected" : ""}>${r}</option>`
            )
            .join("")}
        </select>
        <div class="order-ship-amount">${selected ? money(orderShipping.availableToRefund) : money(0)}</div>
      </div>
    </div>
  `;
}

function renderTotals(summary) {
  return `
    <div class="totals-breakdown">
      <div class="totals-row">
        <span>Merchandise selected</span>
        <span>${money(summary.merchandiseValue)}</span>
      </div>
      <div class="totals-row">
        <span>Big &amp; Bulky shipping</span>
        <span>${money(summary.lineShippingValue)}</span>
      </div>
      <div class="totals-row">
        <span>Standard shipping</span>
        <span>${money(summary.orderShippingValue)}</span>
      </div>
    </div>
    <div class="total-box">
      <span class="label">Total Refund Amount</span>
      <span class="amount">${money(summary.value)}</span>
    </div>
  `;
}

function currentSummary() {
  return summarize(
    state.selections,
    lines,
    state.shippingSelections,
    lineShipping,
    orderShipping,
    state.orderShippingSelected
  );
}

function render() {
  const root = document.getElementById("root");
  const summary = currentSummary();
  const notesError = state.notes.trim().length === 0;

  root.innerHTML = `
    <div class="app">
      <div class="topbar">
        <div>
          <h1>Refund request</h1>
          <p class="subtitle">Select items by package or shipment · line-level refund balance is authoritative</p>
        </div>
        <div class="pill">${summary.merchandiseCount} items · ${money(summary.value)}</div>
      </div>

      <p class="principle"><strong>Product line</strong> = how much can I refund? &nbsp;·&nbsp; <strong>Package / shipment</strong> = where did these physical units come from? &nbsp;·&nbsp; <strong>Line shipping</strong> = separate from merchandise</p>

      <div class="card">
        <label class="field" for="order-reason">Order-level refund reason</label>
        <select id="order-reason" class="select" data-action="order-reason">
          ${reasons
            .map(
              (r, i) =>
                `<option value="${i === 0 ? "" : r}" ${state.orderReason === r ? "selected" : ""}>${r}</option>`
            )
            .join("")}
        </select>
        <p class="help" style="margin-top:6px">Applies to all selected items and shipping. You can override at the item level.</p>
      </div>

      <div class="order-header">
        <div>
          <div class="title">
            ${truckSvg}
            ${orderMeta.store}
          </div>
          <div class="meta">
            <span>${orderMeta.orderedAt}</span>
            <span>${Object.keys(lines).length} product lines</span>
          </div>
        </div>
        <span class="badge">${orderMeta.status}</span>
      </div>

      <div class="shipments">
        ${shipments
          .map((ship) => {
            const checkState = shipmentCheckState(state.selections, ship, lines);
            const shipChecked = checkState === "all" ? "checked" : "";
            const ariaChecked =
              checkState === "partial" ? "mixed" : checkState === "all" ? "true" : "false";
            const trackings = [...new Set(ship.packages.map((p) => p.tracking))];
            const trackingLabel =
              trackings.length === 1
                ? `Tracking: ${trackings[0]}`
                : `Tracking: ${trackings.join(" · ")}`;
            return `
          <section class="shipment" data-shipment="${ship.id}">
            <div class="shipment-head">
              <div class="shipment-head-left">
                <input class="checkbox" type="checkbox" data-action="ship-toggle" data-ship="${ship.id}" data-check-state="${checkState}" ${shipChecked} aria-checked="${ariaChecked}" aria-label="Select shipment" />
                <h3>${ship.label}</h3>
                <a class="tracking" href="#" onclick="return false">${trackingLabel}</a>
                <span class="help">Select all refundable items · shipping separate</span>
              </div>
              <span class="badge">${ship.status}</span>
            </div>
            ${ship.packages.map(renderPackage).join("")}
          </section>
        `;
          })
          .join("")}
      </div>

      ${renderOrderShipping()}

      <div class="card">
        <label class="field" for="source">Source</label>
        <select id="source" class="select" data-action="source">
          <option ${state.source === "Guide" ? "selected" : ""}>Guide</option>
          <option ${state.source === "Phone" ? "selected" : ""}>Phone</option>
          <option ${state.source === "Email" ? "selected" : ""}>Email</option>
          <option ${state.source === "Chat" ? "selected" : ""}>Chat</option>
        </select>
        <label class="field" for="notes" style="margin-top:12px">Additional Notes *</label>
        <textarea id="notes" class="textarea ${notesError ? "error" : ""}" data-action="notes" placeholder="Enter reason for refund and any additional notes (required)">${state.notes}</textarea>
        ${notesError ? `<p class="error-text">Additional notes are required for refund processing.</p>` : ""}
        ${renderTotals(summary)}
        <div class="footer-actions">
          <button class="btn btn-primary" data-action="submit" ${!summary.hasSelection || notesError || !state.orderReason ? "disabled" : ""}>Process Refund</button>
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        </div>
        <div class="payload ${state.submitted ? "show" : ""}" id="payload">${state.submitted ? JSON.stringify(state.submitted, null, 2) : ""}</div>
      </div>
    </div>
  `;

  applyIndeterminateChecks(root);
}

function applyIndeterminateChecks(root) {
  root.querySelectorAll('[data-action="pkg-toggle"], [data-action="ship-toggle"]').forEach((input) => {
    const checkState = input.getAttribute("data-check-state");
    input.indeterminate = checkState === "partial";
    input.checked = checkState === "all";
  });
}

function findPackage(packageId) {
  for (const ship of shipments) {
    const pkg = ship.packages.find((p) => p.id === packageId);
    if (pkg) return pkg;
  }
  return null;
}

function onClick(e) {
  const t = e.target.closest("[data-action]") || e.target;
  const action = t.getAttribute?.("data-action");
  if (!action) return;

  if (action === "item-toggle") {
    const packageId = t.getAttribute("data-pkg");
    const lineId = t.getAttribute("data-line");
    const pkg = findPackage(packageId);
    const alloc = pkg?.allocations.find((a) => a.lineId === lineId);
    if (!pkg || !alloc) return;
    if (t.checked) {
      const max = maxSelectable({
        line: lines[lineId],
        qtyInPackage: alloc.qtyInPackage,
        packageId,
        selections: state.selections,
      });
      state.selections = setSelection(
        state.selections,
        packageId,
        lineId,
        max,
        lines[lineId],
        alloc.qtyInPackage
      );
    } else {
      state.selections = setSelection(
        state.selections,
        packageId,
        lineId,
        0,
        lines[lineId],
        alloc.qtyInPackage
      );
    }
    render();
  }

  if (action === "ship-fee-toggle") {
    const packageId = t.getAttribute("data-pkg");
    const lineId = t.getAttribute("data-line");
    const charge = lineShipping[lineId];
    const pkg = findPackage(packageId);
    const alloc = pkg?.allocations.find((a) => a.lineId === lineId);
    if (!charge || !pkg || !alloc) return;
    if (t.checked) {
      const max = maxShippingSelectable({
        charge,
        qtyInPackage: alloc.qtyInPackage,
        packageId,
        shippingSelections: state.shippingSelections,
      });
      state.shippingSelections = setShippingSelection(
        state.shippingSelections,
        packageId,
        charge,
        alloc.qtyInPackage,
        max
      );
    } else {
      state.shippingSelections = setShippingSelection(
        state.shippingSelections,
        packageId,
        charge,
        alloc.qtyInPackage,
        0
      );
      delete state.shippingReasons[selectionKey(packageId, lineId)];
    }
    render();
  }

  if (action === "order-ship-toggle") {
    state.orderShippingSelected = !!t.checked;
    if (!t.checked) state.orderShippingReason = "";
    render();
  }

  if (action === "ship-toggle") {
    const ship = shipments.find((s) => s.id === t.getAttribute("data-ship"));
    if (!ship) return;
    const current = shipmentCheckState(state.selections, ship, lines);
    if (current === "all") state.selections = clearShipment(state.selections, ship);
    else state.selections = selectShipment(state.selections, ship, lines);
    render();
  }

  if (action === "pkg-toggle") {
    const pkg = findPackage(t.getAttribute("data-pkg"));
    if (!pkg) return;
    const current = packageCheckState(state.selections, pkg, lines);
    if (current === "all") state.selections = clearPackage(state.selections, pkg);
    else state.selections = selectPackage(state.selections, pkg, lines);
    render();
  }

  if (action === "submit") {
    const summary = currentSummary();
    state.submitted = {
      source: state.source,
      orderReason: state.orderReason,
      notes: state.notes,
      merchandiseTotal: summary.merchandiseValue,
      lineShippingTotal: summary.lineShippingValue,
      orderShippingTotal: summary.orderShippingValue,
      total: summary.value,
      items: Object.entries(state.selections).map(([key, qty]) => {
        const [packageId, lineId] = key.split("::");
        return {
          type: "merchandise",
          lineId,
          refundQuantity: qty,
          packageContext: packageId,
          reason: state.itemReasons[key] || state.orderReason,
          unitPrice: lines[lineId].unitPrice,
          amount: qty * lines[lineId].unitPrice,
        };
      }),
      lineShipping: Object.entries(state.shippingSelections).map(([key, amount]) => {
        const [packageId, lineId] = key.split("::");
        const charge = lineShipping[lineId];
        return {
          type: "line_shipping",
          chargeId: charge.id,
          lineId,
          name: charge.name,
          refundAmount: amount,
          packageContext: packageId,
          reason: state.shippingReasons[key] || state.orderReason,
          note: "Package context is for this transaction only; prior shipping refunds are not package-attributed.",
        };
      }),
      orderShipping: state.orderShippingSelected
        ? {
            type: "order_shipping",
            chargeId: orderShipping.id,
            name: orderShipping.name,
            refundAmount: orderShipping.availableToRefund,
            reason: state.orderShippingReason || state.orderReason,
          }
        : null,
    };
    render();
  }

  if (action === "cancel") {
    state.selections = {};
    state.shippingSelections = {};
    state.itemReasons = {};
    state.shippingReasons = {};
    state.orderShippingSelected = false;
    state.orderShippingReason = "";
    state.submitted = null;
    state.notes = "";
    render();
  }
}

function onChange(e) {
  const t = e.target;
  const action = t.getAttribute("data-action");
  if (!action) {
    if (t.id === "order-reason") {
      state.orderReason = t.value;
      render();
    }
    if (t.id === "source") {
      state.source = t.value;
    }
    if (t.id === "notes") {
      state.notes = t.value;
      render();
      const notes = document.getElementById("notes");
      if (notes) {
        notes.focus();
        notes.selectionStart = notes.selectionEnd = notes.value.length;
      }
    }
    return;
  }

  if (action === "qty") {
    const packageId = t.getAttribute("data-pkg");
    const lineId = t.getAttribute("data-line");
    const pkg = findPackage(packageId);
    const alloc = pkg.allocations.find((a) => a.lineId === lineId);
    state.selections = setSelection(
      state.selections,
      packageId,
      lineId,
      Number(t.value),
      lines[lineId],
      alloc.qtyInPackage
    );
    render();
  }

  if (action === "reason") {
    const key = selectionKey(t.getAttribute("data-pkg"), t.getAttribute("data-line"));
    if (t.value) state.itemReasons[key] = t.value;
    else delete state.itemReasons[key];
  }

  if (action === "ship-reason") {
    const key = selectionKey(t.getAttribute("data-pkg"), t.getAttribute("data-line"));
    if (t.value) state.shippingReasons[key] = t.value;
    else delete state.shippingReasons[key];
  }

  if (action === "order-ship-reason") {
    state.orderShippingReason = t.value;
  }

  if (action === "order-reason") {
    state.orderReason = t.value;
    render();
  }

  if (action === "source") state.source = t.value;
  if (action === "notes") {
    state.notes = t.value;
  }
}

document.getElementById("root").addEventListener("click", onClick);
document.getElementById("root").addEventListener("change", onChange);
document.getElementById("root").addEventListener("input", (e) => {
  if (e.target.getAttribute("data-action") === "notes" || e.target.id === "notes") {
    state.notes = e.target.value;
  }
});

render();
