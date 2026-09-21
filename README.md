# Refund package / shipment flow (local prototype)

Interactive local prototype of the Team member Order Management **refund items** experience.

## Design principle

> **Line ID owns the refund balance. Package / shipment owns the fulfilment context.**

- Package quantities = physical fulfilment only
- Merchandise & line-level shipping balances = line-level backend values only
- Never attribute historical refunds to a package
- Bulk select package/shipment = merchandise only (shipping is explicit)

## Run locally

```bash
python3 -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173).

## Demo scenario — line-level Big & Bulky

**14ft Trampoline — Line 123**

| | |
|---|---|
| Quantity | 3 |
| Product | $260 each |
| Big & Bulky | $45 original · $15/unit |
| Previously refunded shipping | $15 |
| Remaining shipping | $30 |

| Package | Qty | Attributable shipping |
|---|---|---|
| Package 1 | 1 (+ Crayola ×2) | $15 |
| Package 2 | 2 | $30 |

Also includes independent **order-level Standard shipping** ($12 remaining).

### Try

1. Refund Package 2 trampoline ×1 ($260) without shipping — shipping stays unchecked.
2. Tick Package 1 Big & Bulky ($15) → Package 2 shipping becomes *Only $15.00 remaining to refund*.
3. Tick Package 2 shipping → selects $15 (not $30); Package 1 shipping exhausts if Package 2 took the rest first.
4. Package/shipment “select all” fills merchandise only — not Big & Bulky.
5. Totals split merchandise / Big & Bulky / Standard shipping.

## Live preview (this branch)

After Pages builds from the PR branch, or merge to main: https://mconway4.github.io/refund-package-flow/

## Stack

Static HTML + CSS + ES modules. No build step.
