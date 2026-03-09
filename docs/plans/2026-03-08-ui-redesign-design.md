# UI Redesign — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design doc.

**Goal:** Full redesign of TCGPlayerShippingSuite using the brand color palette, DM Sans typography, and shadcn/ui components — replacing all generic gray Tailwind styling with a clean, professional, data-dense business tool aesthetic.

**Architecture:** Tailwind CSS v4 custom theme tokens mapped to brand colors, full shadcn/ui library installed, shared sidebar component refactored to carry full nav on all pages.

**Tech Stack:** Next.js 16 App Router, shadcn/ui (full library), Tailwind CSS v4, DM Sans (next/font/google), Lucide React icons, react-hot-toast (restyled)

---

## Color System

| Token | Hex | Usage |
|---|---|---|
| `--color-sidebar` | `#001242` | Sidebar background, login page background, upload drop zone |
| `--color-bg` | `#ffffff` | Main content area |
| `--color-active` | `#0094C6` | Active nav highlight (left border + bg tint), focus rings, progress bars |
| `--color-primary` | `#005E7C` | Primary buttons |
| `--color-dark` | `#000022` | Reserved / deep dark backgrounds |
| `--color-deepest` | `#040F16` | Stat card backgrounds |

---

## Typography

- **Font:** DM Sans loaded via `next/font/google` (weights: 300, 400, 500, 600, 700)
- Applied globally via CSS variable `--font-sans`

---

## Layout

### Sidebar (Fixed, Desktop-only)
- Width: 220px, `#001242` background
- **Brand area:** "TCG Shipping" (h1/24px, bold, white) + "Shipping Suite" (11px, 45% white opacity)
- **Nav items:** White text, transparent left border (inactive) → `#0094C6` left border + 15% cyan bg tint (active)
- **Admin item:** Same styling + "Admin" badge (`#0094C6` tinted)
- **Footer:** Sign out button (55% white opacity)
- Mobile: unstyled (desktop-only tool)

### Content Area
- White background, 28px 32px padding
- No page headers — sidebar nav indicates current page

---

## Pages

### Dashboard (`/dashboard`)
- **Stat cards (3):** `#040F16` background, white label text (45% opacity, uppercase), white value (28px bold), white sub-text (30% opacity)
- **Recent Batches table:** White bg, gray stripe on even rows, thin `#e2e8f0` borders, uppercase muted column headers

### Upload Orders (`/upload`)
- **Drop zone:** `#001242` card, dashed `#0094C6` border (40% opacity), centered icon in cyan circle, white title, muted white subtitle, Browse File button
- **Order preview table:** Columns: Order #, Buyer, City/State, Package, Weight, Est. Cost
  - **Package column:** Dropdown defaulting to "Envelope"; lists pre-saved custom package types
  - **Weight column:** Envelope rows show static `0 / 1 oz` text; non-envelope rows show two inline inputs `[lb] / [oz] oz` (highlighted `#0094C6` border, cyan tint row) — weight is required before label generation
  - Table action bar: Generate Labels (primary), Clear (ghost)

### Single Label (`/dashboard/single-label`)
- Form inputs: white bg, `#001242` border, `#0094C6` focus ring
- Package selector dropdown with pre-saved types
- lb/oz weight inputs when non-envelope package selected

### Batch Detail (`/dashboard/batch/[batchId]`)
- **Button group at top:** Download All Labels (primary), Envelopes Only (outline), Ground Advantage Only (outline), Export CSV (ghost)
- Orders table with type badges (Envelope = blue, Ground = green)

### History (`/dashboard/history`)
- Table with archive action → shadcn AlertDialog confirmation

### Settings (`/dashboard/settings`)
- **Accordion sections** (collapsed by default, click to expand):
  1. **EasyPost API Key** — password input + Save
  2. **From Address** — Name, Street, City, State, ZIP + Save
  3. **Costs & Supplies** — Envelope, Shield, Penny Sleeve, Top Loader cost inputs; "Use penny sleeves by default" + "Default non-machinable" checkboxes
  4. **Thresholds** — Value threshold ($) + Card count threshold (→ Ground Advantage); Non-Machinable Card Count threshold (→ marks envelope non-machinable); separated by divider
  5. **Custom Package Types** — List of saved packages (name + dimensions) with Remove buttons; Add Package Type button
  6. **Logo** — Upload zone (PNG/JPG, max 2MB)

### Billing (`/dashboard/billing`)
- Single status card: `#040F16` header (plan name in `#0094C6`), white body with usage progress bar + upgrade CTA

### Login (`/login`)
- Full-page `#001242` background, centered white card (360px wide)
- Google OAuth button, divider, email/password fields, Sign In button, Sign up link

### Landing (`/`)
- Full `#001242` background, centered hero: eyebrow text (`#0094C6`), headline (white, 36px), subtitle (50% white), dual CTAs (primary + ghost white)
- Redirect authenticated users to `/dashboard`

### Demo (`/demo`)
- Same hero aesthetic as landing page

### Admin (`/admin`)
- Matches main app design exactly
- "Admin" badge visible in sidebar nav

---

## Components

### Buttons
| Variant | Style |
|---|---|
| Primary | `#005E7C` bg, white text |
| Outline | Transparent bg, `#005E7C` border + text |
| Ghost | Transparent bg, `#e2e8f0` border, muted text |
| Danger | `#dc2626` bg, white text |

### Form Inputs
- White bg, `#001242` border (1.5px), `#0094C6` focus ring (3px, 15% opacity)

### Tables
- White bg, `#f8fafc` even row stripe, `#e2e8f0` borders
- Column headers: 11px, uppercase, 600 weight, muted color

### Badges
| Color | Usage |
|---|---|
| Green | Complete, Envelope (Yes) |
| Blue | Archived, Envelope type |
| Yellow | Warning |
| Gray | Neutral/Archived |

### Toasts
- Keep react-hot-toast, restyle to match brand palette

### AlertDialog (shadcn)
- Used for all destructive confirmations (archive batch, remove package, sign out)

---

## shadcn Components to Install
Full library (`npx shadcn@latest add --all`). Key components in use:
`Button`, `Input`, `Card`, `Table`, `Badge`, `Accordion`, `Dialog`, `AlertDialog`, `Separator`, `Label`, `Tabs`, `Progress`, `Avatar`, `Select`, `Checkbox`, `Tooltip`

---

## Sketch Reference
Visual sketch: `docs/design-sketches/ui-sketch.html`
