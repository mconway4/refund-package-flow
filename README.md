# Refund package / shipment flow (local prototype)

Interactive local prototype of the Team member Order Management **refund items** experience, using the Team member guide app Figma as the design system.

## Design principle

> **Line ID owns the refund balance. Package / shipment owns the fulfilment context.**

- Package quantities = physical fulfilment only  
- Refunded / available to refund = line-level backend values only  
- Never attribute historical refunds to a package  

## Run locally

From this folder:

```bash
python3 -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173).

(ES modules require a local server — opening `index.html` as a file will not work.)

## Demo scenario (PRD §17)

**UNO Card Game — Line 123**

| | |
|---|---|
| Ordered | 5 |
| Delivered | 5 |
| Refunded | 1 |
| Available to refund | 4 |

| Shipment | Package | Tracking | UNO in package |
|---|---|---|---|
| Sydney DC | Package 1 | AU123456 | 1 (+ Crayola ×2) |
| Sydney DC | Package 2 | AU123456 | 2 |
| Melbourne DC | Package 3 | AU987654 | 2 |

Try: select Package 1 only (damaged package) → submits Line 123 ×1 with package context `pkg-1`.

Also try exhausting the line balance across packages — remaining package rows stay visible with *No quantity remaining to refund for this product line.* Line ordered / refunded / available values appear on each package row (same line totals everywhere that product appears).

## Acceptance criteria covered

| AC | Behaviour in prototype |
|---|---|
| AC1 | Same line appears in each package allocation |
| AC2 | Line strip shows Ordered / Delivered / Refunded / Available to refund |
| AC3 | No package-level “refunded” attribution |
| AC4 | Select qty capped by qty in package |
| AC5 | Shared line balance across packages |
| AC6 | Package 1 & 2 share tracking AU123456 but remain separate |
| AC7 | Package checkbox selects max eligible under line balances |
| AC8 | Exhausted line still listed; select disabled with explanatory copy |
| AC9 | “Qty in package” column distinct from “Available to refund” |

## Stack

Static HTML + CSS + ES modules. No build step. Styling aligned to the Team member refund screens (teal accents, card layout, Inter).
