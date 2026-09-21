import { orderMeta, reasons, lines, shipments } from "./data.js?v=12";
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
} from "./selection.js?v=12";

const state = {
  selections: {},
  itemReasons: {},
  orderReason: "",
  source: "Guide",
  notes: "",
  submitted: null,
};

const money = (n) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
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
  const reason =
    state.itemReasons[key] || state.orderReason || "";

  // Options only up to current max (MIN of package qty and remaining line balance)
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
        <span class="help">Select all refundable items in this package</span>
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

function render() {
  const root = document.getElementById("root");
  const summary = summarize(state.selections, lines);
  const notesError = state.notes.trim().length === 0;

  root.innerHTML = `
    <div class="app">
      <div class="topbar">
        <div>
          <h1>Refund request</h1>
          <p class="subtitle">Select items by package or shipment · line-level refund balance is authoritative</p>
        </div>
        <div class="pill">${summary.count} selected · ${money(summary.value)}</div>
      </div>

      <p class="principle"><strong>Product line</strong> = how much can I refund? &nbsp;·&nbsp; <strong>Package / shipment</strong> = where did these physical units come from?</p>

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
        <p class="help" style="margin-top:6px">Applies to all selected items. You can override at the item level.</p>
      </div>

      <div class="order-header">
        <div>
          <div class="title">
            <svg width="18" height="14" viewBox="0 0 24 16" fill="none" aria-hidden="true"><path d="M1 4h14v9H1V4zm14 2h4l3 3v4h-7V6zM5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" stroke="currentColor" stroke-width="1.5"/></svg>
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
                <span class="help">Select all refundable items in this shipment</span>
              </div>
              <span class="badge">${ship.status}</span>
            </div>
            ${ship.packages.map(renderPackage).join("")}
          </section>
        `;
          })
          .join("")}
      </div>

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
        <div class="total-box">
          <span class="label">Total Refund Amount</span>
          <span class="amount">${money(summary.value)}</span>
        </div>
        <div class="footer-actions">
          <button class="btn btn-primary" data-action="submit" ${summary.count === 0 || notesError || !state.orderReason ? "disabled" : ""}>Process Refund</button>
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        </div>
        <div class="payload ${state.submitted ? "show" : ""}" id="payload">${state.submitted ? JSON.stringify(state.submitted, null, 2) : ""}</div>
      </div>
    </div>
  `;

  applyIndeterminateChecks(root);
}

/** Indeterminate must be set via JS property — HTML can't express it. */
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
  const t = e.target;
  const action = t.getAttribute("data-action");
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
      // Default to package qty, capped only by remaining line balance
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

  if (action === "ship-toggle") {
    const ship = shipments.find((s) => s.id === t.getAttribute("data-ship"));
    if (!ship) return;
    const current = shipmentCheckState(state.selections, ship, lines);
    // Partial or none → fill to max refundable; fully selected → clear
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
    const summary = summarize(state.selections, lines);
    state.submitted = {
      source: state.source,
      orderReason: state.orderReason,
      notes: state.notes,
      total: summary.value,
      items: Object.entries(state.selections).map(([key, qty]) => {
        const [packageId, lineId] = key.split("::");
        return {
          lineId,
          refundQuantity: qty,
          packageContext: packageId,
          reason: state.itemReasons[key] || state.orderReason,
          unitPrice: lines[lineId].unitPrice,
        };
      }),
      note: "Package context is stored for this transaction only; it is not evidence of prior refund attribution.",
    };
    render();
  }

  if (action === "cancel") {
    state.selections = {};
    state.itemReasons = {};
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
      // soft re-render only error state — full render ok
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
