# Regression Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install Jest, create shared mock factories, and write ~39 test cases covering all critical API route behaviors so cleanup refactoring cannot break business logic silently.

**Architecture:** Import Next.js App Router route handlers directly, call them with `NextRequest` objects, assert on the `Response` status and JSON body. Mock Firebase, EasyPost (via global `fetch`), and Stripe entirely — no network calls, no emulator.

**Tech Stack:** Jest, `next/jest` transform, `@testing-library/jest-dom`, TypeScript, `ts-jest` via `next/jest`

---

## Task 1: Install Jest dependencies and configure

**Files:**
- Modify: `package.json`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

**Step 1: Install dev dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest
```

Expected: packages added to `devDependencies` in `package.json`, no errors.

**Step 2: Create `jest.config.ts`**

```ts
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default createJestConfig(config)
```

**Step 3: Create `jest.setup.ts`**

```ts
// jest.setup.ts
import '@testing-library/jest-dom'
```

**Step 4: Add test script to `package.json`**

Add to the `"scripts"` block:
```json
"test": "jest",
"test:watch": "jest --watch"
```

**Step 5: Verify Jest is wired up**

```bash
npm test -- --listTests
```

Expected: no errors (zero test files listed is fine at this stage).

**Step 6: Commit**

```bash
git add jest.config.ts jest.setup.ts package.json package-lock.json
git commit -m "chore: install and configure Jest with next/jest"
```

---

## Task 2: Create shared mock factories

**Files:**
- Create: `src/__tests__/mocks/firestore.ts`
- Create: `src/__tests__/mocks/easypost.ts`
- Create: `src/__tests__/mocks/stripe.ts`

**Step 1: Create Firestore mock builders**

```ts
// src/__tests__/mocks/firestore.ts

const CURRENT_MONTH = new Date().toISOString().slice(0, 7)

export const BASE_FROM_ADDRESS = {
  name: 'Test Seller',
  street1: '123 Main St',
  city: 'Anytown',
  state: 'NY',
  zip: '10001',
}

export const BASE_USER_SETTINGS = {
  easypostApiKey: 'test-key',
  fromAddress: BASE_FROM_ADDRESS,
  envelopeCost: 0.1,
  shieldCost: 0.1,
  pennySleeveCost: 0.02,
  topLoaderCost: 0.12,
}

export const mockProUser = {
  exists: () => true,
  data: () => ({ ...BASE_USER_SETTINGS, isPro: true }),
}

export const mockFreeUser = {
  exists: () => true,
  data: () => ({ ...BASE_USER_SETTINGS, isPro: false }),
}

export const mockPlanProUser = {
  exists: () => true,
  data: () => ({ ...BASE_USER_SETTINGS, plan: 'pro' }),
}

export const mockNoSettingsUser = {
  exists: () => true,
  data: () => ({}),
}

export const mockUsageUnderLimit = {
  exists: () => true,
  data: () => ({ month: CURRENT_MONTH, count: 5 }),
}

export const mockUsageAtLimit = {
  exists: () => true,
  data: () => ({ month: CURRENT_MONTH, count: 10 }),
}

export const mockNoUsage = {
  exists: () => false,
  data: () => ({ count: 0, month: '' }),
}

export const mockEmptyDocs = {
  docs: [],
  forEach: jest.fn(),
}
```

**Step 2: Create EasyPost fetch mock builders**

```ts
// src/__tests__/mocks/easypost.ts

export const ENVELOPE_RATE = {
  id: 'rate_envelope',
  carrier: 'USPS',
  service: 'First',
  rate: '0.63',
}

export const GROUND_RATE = {
  id: 'rate_ground',
  carrier: 'USPS',
  service: 'GroundAdvantage',
  rate: '5.40',
}

export const CHEAP_NON_USPS_RATE = {
  id: 'rate_cheap',
  carrier: 'UPS',
  service: 'Ground',
  rate: '0.10',
}

export const BOUGHT_LABEL = {
  tracking_code: 'USPS1234567890',
  postage_label: { label_url: 'https://easypost.com/label.pdf' },
  tracker: { public_url: 'https://track.easypost.com/abc' },
}

export const makeShipmentResponse = (rates: object[]) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id: 'shp_test123', rates }),
  })

export const makeBuyResponse = (label = BOUGHT_LABEL) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(label),
  })

export const makeErrorShipmentResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ error: 'Invalid address', rates: [] }),
  })

export const makeFailedBuyResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ error: 'Insufficient funds' }),
  })
```

**Step 3: Create Stripe mock builders**

```ts
// src/__tests__/mocks/stripe.ts

export const makeCheckoutEvent = (email: string | null) => ({
  type: 'checkout.session.completed',
  data: {
    object: {
      customer_email: email,
    },
  },
})

export const makeUnhandledEvent = () => ({
  type: 'payment_intent.created',
  data: { object: {} },
})
```

**Step 4: Verify files exist**

```bash
ls src/__tests__/mocks/
```

Expected: `easypost.ts  firestore.ts  stripe.ts`

**Step 5: Commit**

```bash
git add src/__tests__/mocks/
git commit -m "test: add shared mock factories for Firestore, EasyPost, and Stripe"
```

---

## Task 3: Test `/api/upload` — input validation and free tier

**Files:**
- Create: `src/__tests__/api/upload.test.ts`
- Reference: `src/app/api/upload/route.ts`

**Step 1: Create the test file with module mocks and helpers**

```ts
// src/__tests__/api/upload.test.ts
import { NextRequest } from 'next/server'
import {
  mockProUser,
  mockFreeUser,
  mockPlanProUser,
  mockUsageUnderLimit,
  mockUsageAtLimit,
  mockNoUsage,
  mockNoSettingsUser,
} from '../mocks/firestore'
import {
  ENVELOPE_RATE,
  GROUND_RATE,
  BOUGHT_LABEL,
  makeShipmentResponse,
  makeBuyResponse,
  makeErrorShipmentResponse,
  makeFailedBuyResponse,
} from '../mocks/easypost'

jest.mock('@/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({
  getDoc: jest.fn(),
  setDoc: jest.fn().mockResolvedValue(undefined),
  doc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}))
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))

const { getDoc, setDoc } = jest.requireMock('firebase/firestore')

const BASE_ORDER = {
  userId: 'user123',
  batchId: 'batch123',
  batchName: 'Test Batch',
  name: 'John Doe',
  address1: '456 Oak Ave',
  address2: '',
  city: 'Springfield',
  state: 'IL',
  zip: '62701',
  weight: 1,
  orderNumber: 'ORDER-001',
  useEnvelope: true,
  usePennySleeve: true,
  useTopLoader: false,
  shippingShield: false,
  nonMachinable: false,
  notes: '',
  selectedPackage: null,
}

const makeRequest = (body: object) =>
  new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('POST /api/upload — input validation', () => {
  it('returns 400 if orders array is empty', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const res = await POST(makeRequest([]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No orders provided')
  })

  it('returns 400 if userId is missing', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const res = await POST(makeRequest([{ ...BASE_ORDER, userId: undefined }]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing userId')
  })

  it('returns 400 if user has no easypostApiKey', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc.mockResolvedValueOnce(mockNoSettingsUser)
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('User settings incomplete')
  })
})

describe('POST /api/upload — free tier enforcement', () => {
  it('returns 403 with redirect if free user is at 10-label limit', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.redirect).toBe('/dashboard/billing')
  })

  it('allows request if free user is under the 10-label limit', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageUnderLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(200)
  })

  it('allows request if user isPro === true regardless of usage', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(200)
  })

  it('allows request if user plan === "pro" regardless of usage', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockPlanProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run the tests to verify they pass**

```bash
npm test -- upload --no-coverage
```

Expected: 7 tests pass, 0 fail.

**Step 3: Commit**

```bash
git add src/__tests__/api/upload.test.ts
git commit -m "test: upload route — input validation and free tier enforcement"
```

---

## Task 4: Test `/api/upload` — label generation logic

**Files:**
- Modify: `src/__tests__/api/upload.test.ts`

**Step 1: Add label generation test cases (append to the file)**

```ts
describe('POST /api/upload — label generation logic', () => {
  beforeEach(() => {
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
  })

  it('selects Ground Advantage rate for high-value orders (useEnvelope === false)', async () => {
    const { POST } = await import('@/app/api/upload/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE, GROUND_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const order = { ...BASE_ORDER, useEnvelope: false }
    const res = await POST(makeRequest([order]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groundAdvantage).toHaveLength(1)
    expect(body.envelopes).toHaveLength(0)
    // Verify Ground Advantage rate was selected (it's passed in buy call)
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.service).toBe('GroundAdvantage')
  })

  it('falls back to cheapest rate when Ground Advantage is unavailable', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc.mockReset()
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    const cheaperRate = { ...ENVELOPE_RATE, rate: '0.50' }
    const expensiveRate = { ...ENVELOPE_RATE, id: 'rate2', rate: '1.00' }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([expensiveRate, cheaperRate]))
      .mockResolvedValueOnce(makeBuyResponse())
    const order = { ...BASE_ORDER, useEnvelope: false } // no ground rate available
    const res = await POST(makeRequest([order]))
    expect(res.status).toBe(200)
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.rate).toBe('0.50')
  })

  it('uses customAddress when provided instead of order address fields', async () => {
    const { POST } = await import('@/app/api/upload/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const customAddress = {
      name: 'Custom Name',
      street1: '999 Custom Rd',
      city: 'CustomCity',
      state: 'CA',
      zip: '90210',
      country: 'US',
    }
    const order = { ...BASE_ORDER, customAddress }
    const res = await POST(makeRequest([order]))
    expect(res.status).toBe(200)
    const createCall = (global.fetch as jest.Mock).mock.calls[0]
    const createBody = JSON.parse(createCall[1].body)
    expect(createBody.shipment.to_address.name).toBe('Custom Name')
    expect(createBody.shipment.to_address.street1).toBe('999 Custom Rd')
  })

  it('uses selectedPackage dimensions when provided', async () => {
    const { POST } = await import('@/app/api/upload/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const selectedPackage = {
      name: 'Small Box',
      weight: '8',
      predefined_package: '',
      length: '6',
      width: '4',
      height: '2',
    }
    const order = { ...BASE_ORDER, selectedPackage }
    const res = await POST(makeRequest([order]))
    expect(res.status).toBe(200)
    const createCall = (global.fetch as jest.Mock).mock.calls[0]
    const createBody = JSON.parse(createCall[1].body)
    expect(createBody.shipment.parcel.weight).toBe(8)
    expect(createBody.shipment.parcel.length).toBe('6')
  })

  it('skips an order silently if EasyPost returns no rates', async () => {
    const { POST } = await import('@/app/api/upload/route')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeErrorShipmentResponse())
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groundAdvantage).toHaveLength(0)
    expect(body.envelopes).toHaveLength(0)
  })

  it('skips an order silently if label purchase returns no label_url', async () => {
    const { POST } = await import('@/app/api/upload/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeFailedBuyResponse())
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.envelopes).toHaveLength(0)
  })
})
```

**Step 2: Run to confirm pass**

```bash
npm test -- upload --no-coverage
```

Expected: 13 tests pass.

**Step 3: Commit**

```bash
git add src/__tests__/api/upload.test.ts
git commit -m "test: upload route — label generation logic and rate selection"
```

---

## Task 5: Test `/api/upload` — Firestore writes and post-processing

**Files:**
- Modify: `src/__tests__/api/upload.test.ts`

**Step 1: Append Firestore and post-processing test cases**

```ts
describe('POST /api/upload — Firestore writes', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
  })

  it('creates batch document when batchId is provided', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const batchWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('batchName')
    )
    expect(batchWrite).toBeDefined()
    expect(batchWrite[1].batchName).toBe('Test Batch')
  })

  it('saves order document with correct cost breakdown fields', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    await POST(makeRequest([{ ...BASE_ORDER, usePennySleeve: true, useTopLoader: true }]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const orderWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('trackingCode')
    )
    expect(orderWrite).toBeDefined()
    expect(orderWrite[1].trackingCode).toBe('USPS1234567890')
    expect(orderWrite[1].labelCost).toBe(0.63)
    expect(typeof orderWrite[1].totalCost).toBe('number')
  })
})

describe('POST /api/upload — post-processing', () => {
  it('updates usage count for free users after success', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageUnderLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const usageWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('"count"')
    )
    expect(usageWrite).toBeDefined()
    expect(usageWrite[1].count).toBe(6) // was 5, added 1
  })

  it('does NOT update usage count for Pro users', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const usageWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('"count"') &&
      JSON.stringify(call[1]).includes('"month"')
    )
    expect(usageWrite).toBeUndefined()
  })

  it('returns groundAdvantage and envelopes arrays separated correctly', async () => {
    const { POST } = await import('@/app/api/upload/route')
    getDoc
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockNoUsage)
    const envelopeOrder = { ...BASE_ORDER, orderNumber: 'ORDER-001', useEnvelope: true }
    const groundOrder = { ...BASE_ORDER, orderNumber: 'ORDER-002', useEnvelope: false }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
      .mockResolvedValueOnce(makeShipmentResponse([GROUND_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await POST(makeRequest([envelopeOrder, groundOrder]))
    const body = await res.json()
    expect(body.envelopes).toHaveLength(1)
    expect(body.groundAdvantage).toHaveLength(1)
  })
})
```

**Step 2: Run full upload test suite**

```bash
npm test -- upload --no-coverage
```

Expected: 18 tests pass, 0 fail.

**Step 3: Commit**

```bash
git add src/__tests__/api/upload.test.ts
git commit -m "test: upload route — Firestore writes and post-processing"
```

---

## Task 6: Test `/api/single-label`

**Files:**
- Create: `src/__tests__/api/single-label.test.ts`
- Reference: `src/app/api/single-label/route.ts`

**Step 1: Create the test file**

```ts
// src/__tests__/api/single-label.test.ts
import { NextRequest } from 'next/server'
import {
  mockProUser,
  mockFreeUser,
  mockUsageAtLimit,
  mockUsageUnderLimit,
  mockNoUsage,
  mockNoSettingsUser,
} from '../mocks/firestore'
import {
  ENVELOPE_RATE,
  GROUND_RATE,
  CHEAP_NON_USPS_RATE,
  makeBuyResponse,
  makeShipmentResponse,
} from '../mocks/easypost'

jest.mock('@/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({
  getDoc: jest.fn(),
  setDoc: jest.fn().mockResolvedValue(undefined),
  doc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}))
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))

const { getDoc, setDoc } = jest.requireMock('firebase/firestore')

const BASE_ORDER = {
  userId: 'user123',
  orderNumber: 'ORDER-001',
  customAddress: {
    name: 'Jane Smith',
    street1: '100 Elm St',
    city: 'Shelbyville',
    state: 'TN',
    zip: '37160',
    country: 'US',
  },
  selectedPackage: null,
  nonMachinable: false,
}

const makeRequest = (body: object[]) =>
  new NextRequest('http://localhost/api/single-label', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('POST /api/single-label — input validation', () => {
  it('returns 400 if userId is missing', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    const res = await POST(makeRequest([{ ...BASE_ORDER, userId: undefined }]))
    expect(res.status).toBe(400)
  })

  it('returns 400 if customAddress is missing', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    const res = await POST(makeRequest([{ ...BASE_ORDER, customAddress: undefined }]))
    expect(res.status).toBe(400)
  })

  it('returns 400 if user settings are incomplete', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    getDoc.mockResolvedValueOnce(mockNoSettingsUser)
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/single-label — free tier enforcement', () => {
  it('returns 403 if free user is at 10-label limit', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.redirect).toBe('/dashboard/billing')
  })
})

describe('POST /api/single-label — rate selection', () => {
  beforeEach(() => {
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
  })

  it('filters to only USPS First or GroundAdvantage rates', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE, CHEAP_NON_USPS_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await POST(makeRequest([BASE_ORDER]))
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.carrier).toBe('USPS')
  })

  it('returns 400 if no valid USPS rate is available', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeShipmentResponse([CHEAP_NON_USPS_RATE])
    )
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No USPS/i)
  })

  it('selects cheapest valid USPS rate', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    const cheapFirst = { ...ENVELOPE_RATE, rate: '0.55' }
    const expensiveGround = { ...GROUND_RATE, rate: '5.40' }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([expensiveGround, cheapFirst]))
      .mockResolvedValueOnce(makeBuyResponse())
    await POST(makeRequest([BASE_ORDER]))
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.rate).toBe('0.55')
  })
})

describe('POST /api/single-label — Firestore writes', () => {
  beforeEach(() => {
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
  })

  it('creates or merges the "single-labels" batch document', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const batchWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('Single Labels')
    )
    expect(batchWrite).toBeDefined()
  })

  it('saves order document with correct fields', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const orderWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('trackingCode')
    )
    expect(orderWrite[1].trackingCode).toBe('USPS1234567890')
    expect(orderWrite[1].labelUrl).toBe('https://easypost.com/label.pdf')
    expect(orderWrite[1].batchId).toBe('single-labels')
  })
})

describe('POST /api/single-label — post-processing', () => {
  it('returns labelUrl and trackingCode on success', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await POST(makeRequest([BASE_ORDER]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.labelUrl).toBe('https://easypost.com/label.pdf')
    expect(body.trackingCode).toBe('USPS1234567890')
  })

  it('updates usage for free users after success', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    getDoc
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageUnderLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const usageWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('"count"')
    )
    expect(usageWrite[1].count).toBe(6)
  })

  it('does NOT update usage for Pro users', async () => {
    const { POST } = await import('@/app/api/single-label/route')
    getDoc
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await POST(makeRequest([BASE_ORDER]))
    const setDocCalls = (setDoc as jest.Mock).mock.calls
    const usageWrite = setDocCalls.find((call) =>
      JSON.stringify(call[1]).includes('"count"') &&
      JSON.stringify(call[1]).includes('"month"')
    )
    expect(usageWrite).toBeUndefined()
  })
})
```

**Step 2: Run**

```bash
npm test -- single-label --no-coverage
```

Expected: 12 tests pass.

**Step 3: Commit**

```bash
git add src/__tests__/api/single-label.test.ts
git commit -m "test: single-label route — all 12 cases"
```

---

## Task 7: Test `/api/labels/merge`

**Files:**
- Create: `src/__tests__/api/labels-merge.test.ts`
- Reference: `src/app/api/labels/merge/route.ts`

**Step 1: Create the test file**

```ts
// src/__tests__/api/labels-merge.test.ts
import { NextRequest } from 'next/server'

const FAKE_PDF_BYTES = new Uint8Array([37, 80, 68, 70]) // %PDF magic bytes

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([{}]),
      addPage: jest.fn(),
      getPageIndices: jest.fn().mockReturnValue([0]),
      save: jest.fn().mockResolvedValue(FAKE_PDF_BYTES),
    }),
    load: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([{}]),
      getPageIndices: jest.fn().mockReturnValue([0]),
    }),
  },
}))

const makeRequest = (urls: string[]) =>
  new NextRequest('http://localhost/api/labels/merge', {
    method: 'POST',
    body: JSON.stringify(urls),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('POST /api/labels/merge', () => {
  it('returns a merged PDF with correct Content-Type header', async () => {
    const { POST } = await import('@/app/api/labels/merge/route')
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
    const res = await POST(makeRequest(['https://example.com/label1.pdf']))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('skips a URL if its fetch response is not ok', async () => {
    const { POST } = await import('@/app/api/labels/merge/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    const { PDFDocument } = jest.requireMock('pdf-lib')
    const res = await POST(
      makeRequest(['https://bad.com/broken.pdf', 'https://ok.com/label.pdf'])
    )
    expect(res.status).toBe(200)
    // PDFDocument.load should only be called once (for the successful URL)
    expect(PDFDocument.load).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on unexpected error', async () => {
    const { POST } = await import('@/app/api/labels/merge/route')
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    const res = await POST(makeRequest(['https://example.com/label.pdf']))
    expect(res.status).toBe(500)
  })
})
```

**Step 2: Run**

```bash
npm test -- labels-merge --no-coverage
```

Expected: 3 tests pass.

**Step 3: Commit**

```bash
git add src/__tests__/api/labels-merge.test.ts
git commit -m "test: labels/merge route — PDF merging and error cases"
```

---

## Task 8: Test `/api/stripe/webhook`

**Files:**
- Create: `src/__tests__/api/stripe-webhook.test.ts`
- Reference: `src/app/api/stripe/webhook/route.ts`

**Step 1: Create the test file**

```ts
// src/__tests__/api/stripe-webhook.test.ts
import { NextRequest } from 'next/server'
import { makeCheckoutEvent, makeUnhandledEvent } from '../mocks/stripe'

const mockConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }))
})

jest.mock('@/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn().mockResolvedValue(undefined),
}))

const { getDocs, setDoc } = jest.requireMock('firebase/firestore')

const MOCK_USER_DOC_REF = { id: 'user123' }

const makeRequest = (body = 'raw-body') =>
  new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: {
      'stripe-signature': 'mock-sig',
      'Content-Type': 'application/json',
    },
  })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/stripe/webhook', () => {
  it('returns 400 if signature verification fails', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 200 and does nothing for unhandled event types', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    mockConstructEvent.mockReturnValue(makeUnhandledEvent())
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('sets isPro: true on user doc when checkout.session.completed fires', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    mockConstructEvent.mockReturnValue(makeCheckoutEvent('buyer@example.com'))
    getDocs.mockResolvedValue({
      docs: [{ ref: MOCK_USER_DOC_REF }],
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(setDoc).toHaveBeenCalledWith(
      MOCK_USER_DOC_REF,
      { isPro: true },
      { merge: true }
    )
  })

  it('continues gracefully if session has no customer_email', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    mockConstructEvent.mockReturnValue(makeCheckoutEvent(null))
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('continues gracefully if no Firestore user matches the email', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route')
    mockConstructEvent.mockReturnValue(makeCheckoutEvent('nobody@example.com'))
    getDocs.mockResolvedValue({ docs: [] })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(setDoc).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run**

```bash
npm test -- stripe-webhook --no-coverage
```

Expected: 5 tests pass.

**Step 3: Run the full test suite**

```bash
npm test --no-coverage
```

Expected: ~38 tests pass across 4 files, 0 fail.

**Step 4: Commit**

```bash
git add src/__tests__/api/stripe-webhook.test.ts
git commit -m "test: stripe webhook route — all 5 cases"
```

---

## Task 9: Final verification and green baseline

**Step 1: Run full suite with coverage report**

```bash
npm test -- --coverage --coverageDirectory=coverage
```

Expected: All tests pass. Note the coverage % for API routes — this is the baseline before any cleanup.

**Step 2: Add coverage directory to `.gitignore`**

Open `.gitignore` and add:
```
coverage/
```

**Step 3: Final commit**

```bash
git add .gitignore
git commit -m "chore: add coverage/ to .gitignore and establish green test baseline"
```
