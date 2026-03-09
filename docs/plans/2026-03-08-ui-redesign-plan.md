# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all generic gray Tailwind styling with the brand color palette, DM Sans typography, and shadcn/ui components across all 13 pages.

**Architecture:** Tailwind v4 CSS theme tokens defined in `globals.css` via `@theme inline`, shadcn/ui full library installed, DM Sans loaded via `next/font/google`, SidebarLayout refactored as the single source of truth for nav.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4 (`@import "tailwindcss"` — no tailwind.config.js), shadcn/ui 4.x, DM Sans (next/font/google), Lucide React, react-hot-toast

---

## Critical constraints

- **38 Jest tests must stay green** after every task. Run `npm test` before each commit.
- Tests are in `src/__tests__/api/` and test Hono API routes only — UI changes won't break them, but confirm after each phase.
- Tailwind v4: no `tailwind.config.js`. All theme tokens go in `globals.css` inside `@theme inline {}`.
- shadcn with Tailwind v4: uses CSS variables natively. The `@theme inline` block maps CSS vars to Tailwind utilities.

---

## Task 1: Install shadcn/ui and set brand theme tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Auto-created: `src/components/ui/` (by shadcn CLI)
- Auto-modified: `components.json` (by shadcn CLI)

**Step 1: Run shadcn init**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

This creates `components.json` and adds CSS variable blocks to `globals.css`.

**Step 2: Install the full shadcn component library**

```bash
npx shadcn@latest add --all
```

Accept all prompts. This populates `src/components/ui/` with all shadcn components.

**Step 3: Replace `globals.css` entirely with brand theme**

Replace the full contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme inline {
  --color-background:   var(--background);
  --color-foreground:   var(--foreground);
  --color-sidebar:      var(--sidebar);
  --color-primary:      var(--primary-color);
  --color-active:       var(--active-color);
  --color-deepest:      var(--deepest);
  --color-dark:         var(--dark);
  --color-border:       var(--border);
  --color-muted:        var(--muted);
  --color-muted-fg:     var(--muted-foreground);
  --color-card:         var(--card);
  --color-stripe:       var(--stripe);
  --font-sans:          var(--font-dm-sans);

  /* shadcn required tokens */
  --color-ring:             var(--ring);
  --color-input:            var(--input);
  --color-destructive:      var(--destructive);
  --color-destructive-fg:   var(--destructive-foreground);
  --color-popover:          var(--popover);
  --color-popover-fg:       var(--popover-foreground);
  --color-secondary:        var(--secondary);
  --color-secondary-fg:     var(--secondary-foreground);
  --color-accent:           var(--accent);
  --color-accent-fg:        var(--accent-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}

:root {
  /* Brand palette */
  --background:     #ffffff;
  --foreground:     #0f172a;
  --sidebar:        #001242;
  --primary-color:  #005E7C;
  --active-color:   #0094C6;
  --deepest:        #040F16;
  --dark:           #000022;
  --border:         #e2e8f0;
  --muted:          #f8fafc;
  --muted-foreground: #64748b;
  --stripe:         #f8fafc;
  --card:           #ffffff;

  /* shadcn required tokens */
  --ring:                  #0094C6;
  --input:                 #e2e8f0;
  --radius:                0.5rem;
  --destructive:           #dc2626;
  --destructive-foreground:#ffffff;
  --popover:               #ffffff;
  --popover-foreground:    #0f172a;
  --secondary:             #f1f5f9;
  --secondary-foreground:  #0f172a;
  --accent:                rgba(0,148,198,0.1);
  --accent-foreground:     #001242;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-dm-sans), system-ui, sans-serif;
}
```

**Step 4: Load DM Sans in `src/app/layout.tsx`**

Replace `src/app/layout.tsx` with:

```tsx
import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "TCG Shipping Suite",
  description: "Label generation and batch management for TCGplayer sellers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: "13px",
              background: "#001242",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.1)",
            },
            success: { iconTheme: { primary: "#0094C6", secondary: "#ffffff" } },
            error:   { iconTheme: { primary: "#dc2626",  secondary: "#ffffff" } },
          }}
        />
      </body>
    </html>
  );
}
```

**Step 5: Run tests**

```bash
npm test
```

Expected: 38 passing, 0 failing.

**Step 6: Start dev server and confirm DM Sans loads**

```bash
npm run dev
```

Open `http://localhost:3000`. Font should switch from Arial to DM Sans.

**Step 7: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/components/ui/ components.json
git commit -m "feat: install shadcn/ui, brand theme tokens, DM Sans font"
```

---

## Task 2: Refactor SidebarLayout

**Files:**
- Modify: `src/components/SidebarLayout.tsx`

**Goal:** Replace gray-900/800 Tailwind classes with brand CSS variables. Add full nav (all 7 items). Active state = `#0094C6` left border + tinted bg. Remove emoji from brand name. Add Admin badge.

**Step 1: Replace `src/components/SidebarLayout.tsx` entirely**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import {
  Home,
  UploadCloud,
  FileText,
  History,
  Settings,
  CreditCard,
  LogOut,
  User,
} from "lucide-react";

const links = [
  { href: "/dashboard",              label: "Dashboard",     icon: Home },
  { href: "/upload",                 label: "Upload Orders", icon: UploadCloud },
  { href: "/dashboard/single-label", label: "Single Label",  icon: FileText },
  { href: "/dashboard/history",      label: "History",       icon: History },
  { href: "/dashboard/settings",     label: "Settings",      icon: Settings },
  { href: "/dashboard/billing",      label: "Billing",       icon: CreditCard },
];

export default function SidebarLayout({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="w-[220px] min-w-[220px] hidden md:flex flex-col"
        style={{ background: "var(--sidebar)" }}
      >
        {/* Brand */}
        <div
          className="px-5 py-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-2xl font-bold text-white leading-tight tracking-tight">
            TCG Shipping
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            Shipping Suite
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors"
                style={{
                  borderLeft: active ? "3px solid #0094C6" : "3px solid transparent",
                  background: active ? "rgba(0,148,198,0.15)" : "transparent",
                }}
              >
                <Icon className="w-4 h-4" style={{ opacity: active ? 1 : 0.7 }} />
                {label}
              </Link>
            );
          })}

          {/* Admin (conditional) */}
          {isAdmin && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8 }}>
              <Link
                href="/admin"
                className="flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] font-medium text-white"
                style={{
                  borderLeft: pathname.startsWith("/admin") ? "3px solid #0094C6" : "3px solid transparent",
                  background: pathname.startsWith("/admin") ? "rgba(0,148,198,0.15)" : "transparent",
                }}
              >
                <User className="w-4 h-4" style={{ opacity: 0.7 }} />
                Admin
                <span
                  className="ml-auto text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(0,148,198,0.3)", color: "#0094C6" }}
                >
                  Admin
                </span>
              </Link>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[13px]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-background p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

**Step 2: Run tests**

```bash
npm test
```

Expected: 38 passing.

**Step 3: Visual check**

```bash
npm run dev
```

Navigate to `/dashboard`. Sidebar should show `#001242` navy, white text, `#0094C6` active highlight on Dashboard link.

**Step 4: Commit**

```bash
git add src/components/SidebarLayout.tsx
git commit -m "feat: rebrand SidebarLayout with navy palette and full nav"
```

---

## Task 3: Dashboard page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Goal:** Dark stat cards (`#040F16` bg, white numbers), striped table, shadcn `Card`/`Badge`.

**Step 1: Read current file**

```bash
cat src/app/dashboard/page.tsx
```

Note the data-fetching pattern (Firestore queries, stats calculation) — preserve all logic. Only replace JSX/className.

**Step 2: Replace the return JSX in `src/app/dashboard/page.tsx`**

Keep all imports, hooks, and data logic unchanged. Replace only the `return (...)` block:

```tsx
// At top, add shadcn imports:
import { Badge } from "@/components/ui/badge";

// Replace return block:
return (
  <SidebarLayout>
    {/* Stat Cards */}
    <div className="grid grid-cols-3 gap-4 mb-7">
      {[
        { label: "Total Batches",     value: totalBatches },
        { label: "Labels Generated",  value: totalLabels },
        { label: "Postage Spent",     value: `$${totalPostage.toFixed(2)}` },
      ].map(({ label, value }) => (
        <div
          key={label}
          className="rounded-xl px-5 py-5"
          style={{ background: "var(--deepest)" }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {label}
          </div>
          <div className="text-3xl font-bold text-white leading-none">{value}</div>
          <div className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            All time
          </div>
        </div>
      ))}
    </div>

    {/* Recent Batches */}
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <div className="px-4 py-3 text-[13px] font-semibold border-b bg-white" style={{ borderColor: "var(--border)" }}>
        Recent Batches
      </div>
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr style={{ background: "var(--stripe)" }}>
            {["Batch Name", "Date", "Labels", "Total Cost", "Status"].map(h => (
              <th key={h} className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b" style={{ color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recentBatches.map((batch, i) => (
            <tr key={batch.id} style={{ background: i % 2 === 0 ? "#ffffff" : "var(--stripe)" }}>
              <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <Link href={`/dashboard/batch/${batch.id}`} className="hover:underline font-medium" style={{ color: "var(--primary-color)" }}>
                  {batch.batchName}
                </Link>
              </td>
              <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                {batch.createdAt?.toDate?.().toLocaleDateString() ?? "—"}
              </td>
              <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                {batch.labelCount ?? "—"}
              </td>
              <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                {batch.totalCost != null ? `$${Number(batch.totalCost).toFixed(2)}` : "—"}
              </td>
              <td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <Badge variant={batch.archived ? "secondary" : "default"} className="text-[11px]">
                  {batch.archived ? "Archived" : "Complete"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </SidebarLayout>
);
```

**Step 3: Run tests**

```bash
npm test
```

Expected: 38 passing.

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: redesign dashboard with dark stat cards and striped table"
```

---

## Task 4: History page

**Files:**
- Modify: `src/app/dashboard/history/page.tsx`

**Goal:** Same table treatment as dashboard. Archive button triggers shadcn `AlertDialog`.

**Step 1: Read current file**

```bash
cat src/app/dashboard/history/page.tsx
```

**Step 2: Add AlertDialog import and replace JSX**

Add at top:
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
```

Replace table rows to use the striped pattern from Task 3. Replace archive buttons with:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <button
      className="text-[12px] px-3 py-1.5 rounded border font-medium transition-colors"
      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
    >
      Archive
    </button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Archive this batch?</AlertDialogTitle>
      <AlertDialogDescription>
        This will archive &ldquo;{batch.batchName}&rdquo;. You can still access it from History.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => handleArchive(batch.id)}
        className="bg-destructive text-white hover:bg-destructive/90"
      >
        Archive Batch
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 3: Run tests, then commit**

```bash
npm test
git add src/app/dashboard/history/page.tsx
git commit -m "feat: redesign history page with AlertDialog archive confirmation"
```

---

## Task 5: Batch Detail page

**Files:**
- Modify: `src/app/dashboard/batch/[batchId]/page.tsx`

**Goal:** Button group at top, striped orders table with type badges.

**Step 1: Read current file**

```bash
cat "src/app/dashboard/batch/[batchId]/page.tsx"
```

**Step 2: Replace JSX — button group + table**

Add to top of component:
```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
```

Replace action area with:
```tsx
{/* Button group at top */}
<div className="flex gap-2 mb-5">
  <Button onClick={handleDownloadAll} style={{ background: "var(--primary-color)", color: "#fff" }}>
    Download All Labels
  </Button>
  <Button
    variant="outline"
    onClick={handleDownloadEnvelopes}
    style={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
  >
    Envelopes Only
  </Button>
  <Button
    variant="outline"
    onClick={handleDownloadGround}
    style={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
  >
    Ground Advantage Only
  </Button>
  <Button
    variant="ghost"
    onClick={handleExportCSV}
    style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
    className="border"
  >
    Export CSV
  </Button>
</div>
```

Type badge in table rows:
```tsx
<Badge variant={order.useEnvelope ? "default" : "secondary"}>
  {order.useEnvelope ? "Envelope" : "Ground"}
</Badge>
```

**Step 3: Run tests, then commit**

```bash
npm test
git add "src/app/dashboard/batch/[batchId]/page.tsx"
git commit -m "feat: redesign batch detail with button group and type badges"
```

---

## Task 6: Upload page — drop zone + Package/Weight columns

**Files:**
- Modify: `src/app/upload/page.tsx`

**Goal:** `#001242` drop zone card, Package dropdown column (defaults to Envelope, shows pre-saved types), Weight column (static `0 / X oz` for envelopes; `[lb] / [oz] oz` inputs for packages with `#0094C6` highlight).

**Step 1: Read full upload page**

```bash
cat src/app/upload/page.tsx
```

**Step 2: Add package/weight state to ParsedRow type**

The existing `selectedPackage` and `useEnvelope` fields handle this. Add a `weightLb` field:

```tsx
// In ParsedRow type, add:
weightLb?: number;  // pounds portion for custom packages
```

**Step 3: Replace drop zone JSX**

Find the existing drop zone / file input area and replace with:

```tsx
<div
  className="rounded-xl p-9 text-center mb-6 cursor-pointer"
  style={{
    background: "var(--sidebar)",
    border: "2px dashed rgba(0,148,198,0.4)",
  }}
  onClick={() => fileInputRef.current?.click()}
  onDragOver={(e) => e.preventDefault()}
  onDrop={handleDrop}
>
  <div
    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3.5"
    style={{ background: "rgba(0,148,198,0.15)" }}
  >
    <UploadCloud className="w-7 h-7" style={{ color: "#0094C6" }} />
  </div>
  <div className="text-[15px] font-semibold text-white mb-1.5">Drop your CSV here</div>
  <div className="text-[12px] mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
    or click to browse — supports TCGPlayer order export format
  </div>
  <button
    className="text-[13px] font-semibold px-4 py-2 rounded-md text-white"
    style={{ background: "var(--primary-color)" }}
    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
  >
    Browse File
  </button>
  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
</div>
```

**Step 4: Replace order preview table columns**

Change the column headers from the existing set to:

```tsx
<thead>
  <tr style={{ background: "var(--stripe)" }}>
    {["Order #", "Buyer", "City, State", "Package", "Weight", "Est. Cost"].map(h => (
      <th key={h} className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b" style={{ color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
        {h}
      </th>
    ))}
  </tr>
</thead>
```

In each `<tr>` for orders, replace the package/envelope cell with:

```tsx
{/* Package column */}
<td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
  <select
    className="h-7 border rounded text-[12px] px-1.5 min-w-[120px] outline-none"
    style={{ borderColor: order.selectedPackage ? "var(--active-color)" : "var(--border)" }}
    value={order.selectedPackage?.name ?? "Envelope"}
    onChange={(e) => handlePackageChange(i, e.target.value)}
  >
    <option value="Envelope">Envelope</option>
    {packageTypes.map((pkg) => (
      <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
    ))}
  </select>
</td>

{/* Weight column */}
<td className="px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
  {!order.selectedPackage ? (
    <span className="text-[12px]">0 / {order.weight} oz</span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        className="w-10 h-7 text-center text-[12px] rounded border outline-none"
        style={{ borderColor: "var(--active-color)" }}
        placeholder="0"
        value={order.weightLb ?? ""}
        onChange={(e) => handleWeightLbChange(i, e.target.value)}
      />
      <span className="text-[11px]">/</span>
      <input
        type="text"
        className="w-10 h-7 text-center text-[12px] rounded border outline-none"
        style={{ borderColor: "var(--active-color)" }}
        placeholder="0"
        value={order.weight ?? ""}
        onChange={(e) => handleWeightOzChange(i, e.target.value)}
      />
      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>oz</span>
    </span>
  )}
</td>
```

**Step 5: Add handler functions**

Add these handler functions inside the component (before `return`):

```tsx
const handlePackageChange = (index: number, packageName: string) => {
  setOrders(prev => prev.map((o, i) => {
    if (i !== index) return o;
    if (packageName === "Envelope") return { ...o, selectedPackage: null, useEnvelope: true };
    const pkg = packageTypes.find(p => p.name === packageName) ?? null;
    return { ...o, selectedPackage: pkg, useEnvelope: false };
  }));
};

const handleWeightLbChange = (index: number, value: string) => {
  setOrders(prev => prev.map((o, i) => i === index ? { ...o, weightLb: Number(value) || 0 } : o));
};

const handleWeightOzChange = (index: number, value: string) => {
  setOrders(prev => prev.map((o, i) => i === index ? { ...o, weight: Number(value) || 0 } : o));
};
```

**Step 6: Highlight rows with custom packages**

Add `style` to `<tr>`:
```tsx
<tr
  key={i}
  style={{
    background: order.selectedPackage
      ? "rgba(0,148,198,0.04)"
      : i % 2 === 0 ? "#ffffff" : "var(--stripe)",
  }}
>
```

**Step 7: Run tests, then commit**

```bash
npm test
git add src/app/upload/page.tsx
git commit -m "feat: redesign upload page with navy drop zone and Package/Weight columns"
```

---

## Task 7: Settings page — accordion

**Files:**
- Modify: `src/components/SettingsForm.tsx`

**Goal:** Wrap each settings section in a shadcn `Accordion` item. Replace all form inputs with styled inputs (white bg, `#001242` border, `#0094C6` focus ring). Replace save buttons with `Button` variant primary.

**Step 1: Read SettingsForm.tsx**

```bash
cat src/components/SettingsForm.tsx
```

**Step 2: Add accordion + shadcn imports**

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
```

**Step 3: Replace the return block**

Wrap sections as AccordionItems. The structure:

```tsx
return (
  <Accordion type="single" collapsible className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>

    {/* EasyPost API Key */}
    <AccordionItem value="easypost">
      <AccordionTrigger className="px-4 py-3.5 text-[13.5px] font-semibold hover:no-underline">
        EasyPost API Key
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ background: "var(--stripe)" }}>
        <div className="flex flex-col gap-1 max-w-sm">
          <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
            API Key
          </Label>
          <Input
            type={showApiKey ? "text" : "password"}
            value={easypostApiKey}
            onChange={(e) => setEasypostApiKey(e.target.value)}
            className="h-9 text-[13px]"
            style={{ borderColor: "var(--sidebar)", "--tw-ring-color": "var(--active-color)" } as React.CSSProperties}
          />
        </div>
        <Button
          onClick={handleSaveApiKey}
          className="mt-3 text-[12px] h-8"
          style={{ background: "var(--primary-color)", color: "#fff" }}
        >
          Save Key
        </Button>
      </AccordionContent>
    </AccordionItem>

    {/* From Address */}
    <AccordionItem value="address">
      <AccordionTrigger className="px-4 py-3.5 text-[13.5px] font-semibold hover:no-underline">
        From Address
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ background: "var(--stripe)" }}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { label: "Full Name",  field: "name",  value: fromName,   setter: setFromName },
            { label: "Street",     field: "street", value: fromStreet, setter: setFromStreet },
            { label: "City",       field: "city",   value: fromCity,   setter: setFromCity },
            { label: "State",      field: "state",  value: fromState,  setter: setFromState },
            { label: "ZIP",        field: "zip",    value: fromZip,    setter: setFromZip },
          ].map(({ label, field, value, setter }) => (
            <div key={field} className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                {label}
              </Label>
              <Input
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="h-9 text-[13px]"
                style={{ borderColor: "var(--sidebar)" }}
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSaveAddress} className="text-[12px] h-8" style={{ background: "var(--primary-color)", color: "#fff" }}>
          Save Address
        </Button>
      </AccordionContent>
    </AccordionItem>

    {/* Costs & Supplies */}
    <AccordionItem value="costs">
      <AccordionTrigger className="px-4 py-3.5 text-[13.5px] font-semibold hover:no-underline">
        Costs &amp; Supplies
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ background: "var(--stripe)" }}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Envelope Cost ($)",   value: envelopeCost,   setter: setEnvelopeCost },
            { label: "Shipping Shield ($)",  value: shieldCost,     setter: setShieldCost },
            { label: "Penny Sleeve ($)",     value: pennySleeveC,   setter: setPennySleeveC },
            { label: "Top Loader ($)",       value: topLoaderCost,  setter: setTopLoaderCost },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{label}</Label>
              <Input value={value} onChange={(e) => setter(e.target.value)} className="h-9 text-[13px]" style={{ borderColor: "var(--sidebar)" }} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Checkbox id="use-penny" checked={usePennySleeve} onCheckedChange={(v) => setUsePennySleeve(!!v)} />
            <Label htmlFor="use-penny" className="text-[13px] cursor-pointer">Use penny sleeves by default</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="non-mach" checked={defaultNonMachinable} onCheckedChange={(v) => setDefaultNonMachinable(!!v)} />
            <Label htmlFor="non-mach" className="text-[13px] cursor-pointer">Default non-machinable</Label>
          </div>
        </div>
        <Button onClick={handleSaveCosts} className="text-[12px] h-8" style={{ background: "var(--primary-color)", color: "#fff" }}>
          Save Costs
        </Button>
      </AccordionContent>
    </AccordionItem>

    {/* Thresholds */}
    <AccordionItem value="thresholds">
      <AccordionTrigger className="px-4 py-3.5 text-[13.5px] font-semibold hover:no-underline">
        Thresholds
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ background: "var(--stripe)" }}>
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Value Threshold ($)</Label>
            <Input value={valueThreshold} onChange={(e) => setValueThreshold(e.target.value)} className="h-9 text-[13px]" style={{ borderColor: "var(--sidebar)" }} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Card Count Threshold</Label>
            <Input value={cardCountThreshold} onChange={(e) => setCardCountThreshold(e.target.value)} className="h-9 text-[13px]" style={{ borderColor: "var(--sidebar)" }} />
          </div>
        </div>
        <p className="text-[11px] mb-4" style={{ color: "var(--muted-foreground)" }}>
          Orders above either threshold use Ground Advantage instead of envelope.
        </p>
        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-1 max-w-[200px] mb-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Non-Machinable Card Count</Label>
            <Input value={nonMachThreshold} onChange={(e) => setNonMachThreshold(e.target.value)} className="h-9 text-[13px]" style={{ borderColor: "var(--sidebar)" }} />
          </div>
          <p className="text-[11px] mb-4" style={{ color: "var(--muted-foreground)" }}>
            Envelopes at or above this card count are marked non-machinable.
          </p>
        </div>
        <Button onClick={handleSaveThresholds} className="text-[12px] h-8" style={{ background: "var(--primary-color)", color: "#fff" }}>
          Save Thresholds
        </Button>
      </AccordionContent>
    </AccordionItem>

    {/* Custom Package Types */}
    <AccordionItem value="packages">
      <AccordionTrigger className="px-4 py-3.5 text-[13.5px] font-semibold hover:no-underline">
        Custom Package Types
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ background: "var(--stripe)" }}>
        <div className="flex flex-col gap-2 mb-3">
          {packageTypes.map((pkg) => (
            <div key={pkg.name} className="flex items-center justify-between bg-white border rounded-md px-3 py-2 text-[13px]" style={{ borderColor: "var(--border)" }}>
              <span>
                {pkg.name}{" "}
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  {pkg.length}×{pkg.width}×{pkg.height} in
                </span>
              </span>
              <Button
                variant="destructive"
                className="text-[11px] h-7 px-2"
                onClick={() => handleRemovePackage(pkg.name)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="text-[12px] h-8"
          style={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
          onClick={() => setShowAddPackage(true)}
        >
          + Add Package Type
        </Button>
      </AccordionContent>
    </AccordionItem>

    {/* Logo */}
    <AccordionItem value="logo">
      <AccordionTrigger className="px-4 py-3.5 text-[13.5px] font-semibold hover:no-underline">
        Logo
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4" style={{ background: "var(--stripe)" }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 border rounded-lg flex items-center justify-center" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
            ) : (
              <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>No logo</span>
            )}
          </div>
          <div>
            <Button
              variant="outline"
              className="text-[12px] h-8"
              style={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
              onClick={() => logoInputRef.current?.click()}
            >
              Upload Logo
            </Button>
            <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>PNG or JPG, max 2MB</p>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>

  </Accordion>
);
```

**Note:** Match state variable names exactly to what's in the current SettingsForm.tsx. The above uses descriptive names — map them to the actual variable names found in the file.

**Step 4: Add `nonMachThreshold` state if not present**

If `nonMachThreshold` doesn't exist in SettingsForm, add it:
```tsx
const [nonMachThreshold, setNonMachThreshold] = useState<string>("3");
```

And save it in `handleSaveThresholds` alongside other threshold fields.

**Step 5: Run tests, then commit**

```bash
npm test
git add src/components/SettingsForm.tsx
git commit -m "feat: redesign settings as shadcn accordion with brand styling"
```

---

## Task 8: Billing page

**Files:**
- Modify: `src/app/dashboard/billing/BillingPageContent.tsx`

**Goal:** Single dark status card with usage progress bar + upgrade CTA.

**Step 1: Read current billing content**

```bash
cat src/app/dashboard/billing/BillingPageContent.tsx
```

**Step 2: Replace JSX — preserve all data-fetching logic**

Add imports:
```tsx
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
```

Replace return block:
```tsx
return (
  <SidebarLayout>
    <div className="border rounded-xl overflow-hidden max-w-lg" style={{ borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="px-5 py-5" style={{ background: "var(--deepest)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Current Plan
        </div>
        <div className="text-[22px] font-bold" style={{ color: "#0094C6" }}>
          {isPro ? "Pro" : "Free Tier"}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5 bg-white">
        {!isPro && (
          <>
            <div className="flex justify-between text-[12px] mb-2" style={{ color: "var(--muted-foreground)" }}>
              <span>Labels used this month</span>
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                {usageCount} / 10
              </span>
            </div>
            <Progress
              value={(usageCount / 10) * 100}
              className="h-2 mb-5"
              style={{ "--progress-background": "var(--active-color)" } as React.CSSProperties}
            />
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--muted-foreground)" }}>
              You have <strong>{Math.max(0, 10 - usageCount)} labels remaining</strong> this month.
              Upgrade to Pro for unlimited labels and advanced features.
            </p>
          </>
        )}
        {isPro && (
          <p className="text-[13px] mb-4" style={{ color: "var(--muted-foreground)" }}>
            You have unlimited label generation on the Pro plan.
          </p>
        )}
        {!isPro && (
          <Button style={{ background: "var(--primary-color)", color: "#fff" }} onClick={handleUpgrade}>
            Upgrade to Pro
          </Button>
        )}
      </div>
    </div>
  </SidebarLayout>
);
```

**Step 3: Run tests, then commit**

```bash
npm test
git add src/app/dashboard/billing/BillingPageContent.tsx
git commit -m "feat: redesign billing page with dark plan card and progress bar"
```

---

## Task 9: Login page

**Files:**
- Modify: `src/app/login/page.tsx`

**Goal:** Full `#001242` page background, centered white card (360px), Google + email/password form.

**Step 1: Read current login page**

```bash
cat src/app/login/page.tsx
```

**Step 2: Replace JSX — preserve all auth logic (signIn, signUp, Google, email verification)**

Add imports:
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

Replace return block:
```tsx
return (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ background: "var(--sidebar)" }}
  >
    <div
      className="w-[360px] rounded-xl px-8 py-9 bg-white"
      style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
    >
      <div className="text-[16px] font-bold mb-0.5" style={{ color: "var(--sidebar)" }}>
        TCG Shipping Suite
      </div>
      <div className="text-[12px] mb-6" style={{ color: "var(--muted-foreground)" }}>
        Ship smarter. Print faster.
      </div>

      {/* Google */}
      <button
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-2 border rounded-md py-2.5 text-[13px] font-medium mb-2 bg-white hover:bg-gray-50 transition-colors"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Google SVG */}
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-2.5 my-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        or
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Email/Password */}
      <div className="flex flex-col gap-1 mb-2.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-9 text-[13px]"
          style={{ borderColor: "var(--sidebar)" }}
        />
      </div>
      <div className="flex flex-col gap-1 mb-4">
        <Label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="h-9 text-[13px]"
          style={{ borderColor: "var(--sidebar)" }}
        />
      </div>

      <Button
        className="w-full justify-center text-[13px]"
        style={{ background: "var(--primary-color)", color: "#fff" }}
        onClick={handleSignIn}
      >
        Sign In
      </Button>

      <p className="text-center text-[12px] mt-3.5" style={{ color: "var(--muted-foreground)" }}>
        Don&apos;t have an account?{" "}
        <button onClick={handleSwitchToSignUp} className="font-semibold" style={{ color: "var(--primary-color)" }}>
          Sign up
        </button>
      </p>

      {error && <p className="text-[12px] text-red-600 text-center mt-2">{error}</p>}
    </div>
  </div>
);
```

**Step 3: Run tests, then commit**

```bash
npm test
git add src/app/login/page.tsx
git commit -m "feat: redesign login with navy background and centered white card"
```

---

## Task 10: Landing page + Demo page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/demo/page.tsx`

**Goal:** Minimal centered hero on `#001242` background. Preserve auth redirect logic.

**Step 1: Replace `src/app/page.tsx` return block**

Keep all hooks/auth logic. Replace JSX:

```tsx
return (
  <div
    className="min-h-screen flex flex-col items-center justify-center text-center px-8 py-12"
    style={{ background: "var(--sidebar)" }}
  >
    <div
      className="text-[11px] font-bold uppercase tracking-[.15em] mb-3.5"
      style={{ color: "var(--active-color)" }}
    >
      TCGPlayer Shipping Suite
    </div>
    <h1 className="text-[36px] font-bold text-white leading-tight max-w-lg mb-3.5">
      Batch labels in seconds, not hours
    </h1>
    <p className="text-[15px] max-w-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
      Upload your TCGPlayer orders, generate USPS labels, and print — all in one place.
    </p>
    <div className="flex gap-3">
      <Link
        href="/login"
        className="text-[14px] font-semibold px-6 py-2.5 rounded-md text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--primary-color)" }}
      >
        Get Started Free
      </Link>
      <Link
        href="/demo"
        className="text-[14px] font-semibold px-6 py-2.5 rounded-md border transition-opacity hover:opacity-90"
        style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)" }}
      >
        Watch Demo
      </Link>
    </div>
  </div>
);
```

**Step 2: Apply same hero wrapper to `src/app/demo/page.tsx`**

Read the demo page, wrap existing content in the same `#001242` background div with the eyebrow + headline aesthetic. The demo's functional content stays — just restyle the outer wrapper.

**Step 3: Run tests, then commit**

```bash
npm test
git add src/app/page.tsx src/app/demo/page.tsx
git commit -m "feat: redesign landing and demo pages with navy hero"
```

---

## Task 11: Single Label page

**Files:**
- Modify: `src/app/dashboard/single-label/page.tsx`

**Goal:** Apply brand form input styling (white bg, `#001242` border, `#0094C6` focus ring). Package dropdown + lb/oz weight inputs for non-envelope selection.

**Step 1: Read the page**

```bash
cat src/app/dashboard/single-label/page.tsx
```

**Step 2: Replace form inputs with styled versions**

Add imports:
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

Apply the same `style={{ borderColor: "var(--sidebar)" }}` pattern to all inputs. Replace action button with `Button` component using `style={{ background: "var(--primary-color)", color: "#fff" }}`.

For the package selector, if the page already has `selectedPackage` state: show lb/oz inputs when `selectedPackage !== null`, same as Task 6.

**Step 3: Run tests, then commit**

```bash
npm test
git add src/app/dashboard/single-label/page.tsx
git commit -m "feat: apply brand form styling to single label page"
```

---

## Task 12: Final polish + verify

**Step 1: Run full test suite**

```bash
npm test
```

Expected: 38 passing, 0 failing.

**Step 2: Build check**

```bash
npm run build
```

Expected: No TypeScript or build errors.

**Step 3: Visual walkthrough**

```bash
npm run dev
```

Walk through every page and confirm:
- [ ] DM Sans font loaded everywhere
- [ ] Sidebar shows `#001242` navy on all protected pages
- [ ] Active nav item has `#0094C6` left border
- [ ] Stat cards show `#040F16` bg with white numbers
- [ ] Tables have gray striping and thin borders
- [ ] Form inputs have `#001242` border + `#0094C6` focus ring
- [ ] Primary buttons are `#005E7C`
- [ ] Upload drop zone is `#001242` with dashed cyan border
- [ ] Package column shows Envelope by default; lb/oz inputs appear for custom packages
- [ ] Settings accordion collapses/expands correctly
- [ ] Billing shows dark plan card with progress bar
- [ ] Login is full `#001242` page with centered white card
- [ ] Landing is minimal hero on `#001242`
- [ ] AlertDialog fires on archive actions

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete UI redesign — brand palette, shadcn/ui, DM Sans"
```
