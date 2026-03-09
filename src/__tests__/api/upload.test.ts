/**
 * Tests for POST /api/labels/batch (Hono route)
 */
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
  makeShipmentResponse,
  makeBuyResponse,
  makeErrorShipmentResponse,
  makeFailedBuyResponse,
} from '../mocks/easypost'

// jest.mock factories must NOT reference variables (TDZ issue with hoisting).
// We configure the mock chain in beforeEach instead.
jest.mock('@/lib/admin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user123' }),
  },
  adminDb: {
    collection: jest.fn(),
  },
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
}))

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))

import { app } from '@/app/api/[[...route]]/route'

let mockGet: jest.Mock
let mockSet: jest.Mock

const BASE_ORDER = {
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
  // selectedPackage intentionally omitted — Zod rejects null for .optional() fields
}

const makeRequest = (body: object) =>
  app.request('/api/labels/batch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock-token',
    },
  })

beforeEach(() => {
  jest.clearAllMocks()
  mockGet = jest.fn()
  mockSet = jest.fn().mockResolvedValue(undefined)
  global.fetch = jest.fn()

  const { adminDb, adminAuth } = jest.requireMock('@/lib/admin')
  adminAuth.verifyIdToken.mockResolvedValue({ uid: 'user123' })
  adminDb.collection.mockReturnValue({
    doc: jest.fn().mockReturnValue({ get: mockGet, set: mockSet }),
    where: jest.fn().mockReturnValue({ get: mockGet }),
  })
})

describe('POST /api/labels/batch — auth', () => {
  it('returns 401 if Authorization header is missing', async () => {
    const res = await app.request('/api/labels/batch', {
      method: 'POST',
      body: JSON.stringify([BASE_ORDER]),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/labels/batch — input validation', () => {
  it('returns 400 if user has no easypostApiKey', async () => {
    mockGet.mockResolvedValueOnce(mockNoSettingsUser)
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(400)
  })
})

describe('POST /api/labels/batch — free tier enforcement', () => {
  it('returns 403 with redirect if free user is at 10-label limit', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.redirect).toBe('/dashboard/billing')
  })

  it('allows request if free user is under the 10-label limit', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageUnderLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(200)
  })

  it('allows request if user isPro === true regardless of usage', async () => {
    mockGet
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(200)
  })

  it('allows request if user plan === "pro" regardless of usage', async () => {
    mockGet
      .mockResolvedValueOnce(mockPlanProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(200)
  })
})

describe('POST /api/labels/batch — label generation logic', () => {
  beforeEach(() => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
  })

  it('selects Ground Advantage rate for high-value orders (useEnvelope === false)', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE, GROUND_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const order = { ...BASE_ORDER, useEnvelope: false }
    const res = await makeRequest([order])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groundAdvantage).toHaveLength(1)
    expect(body.envelopes).toHaveLength(0)
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.service).toBe('GroundAdvantage')
  })

  it('falls back to cheapest rate when Ground Advantage is unavailable', async () => {
    mockGet.mockReset()
    const { adminDb } = jest.requireMock('@/lib/admin')
    adminDb.collection.mockReturnValue({
      doc: jest.fn().mockReturnValue({ get: mockGet, set: mockSet }),
      where: jest.fn().mockReturnValue({ get: mockGet }),
    })
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    const cheaperRate = { ...ENVELOPE_RATE, rate: '0.50' }
    const expensiveRate = { ...ENVELOPE_RATE, id: 'rate2', rate: '1.00' }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([expensiveRate, cheaperRate]))
      .mockResolvedValueOnce(makeBuyResponse())
    const order = { ...BASE_ORDER, useEnvelope: false }
    const res = await makeRequest([order])
    expect(res.status).toBe(200)
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.rate).toBe('0.50')
  })

  it('uses customAddress when provided instead of order address fields', async () => {
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
    const res = await makeRequest([order])
    expect(res.status).toBe(200)
    const createCall = (global.fetch as jest.Mock).mock.calls[0]
    const createBody = JSON.parse(createCall[1].body)
    expect(createBody.shipment.to_address.name).toBe('Custom Name')
    expect(createBody.shipment.to_address.street1).toBe('999 Custom Rd')
  })

  it('uses selectedPackage dimensions when provided', async () => {
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
    const res = await makeRequest([order])
    expect(res.status).toBe(200)
    const createCall = (global.fetch as jest.Mock).mock.calls[0]
    const createBody = JSON.parse(createCall[1].body)
    expect(createBody.shipment.parcel.weight).toBe(8)
    expect(createBody.shipment.parcel.length).toBe('6')
  })

  it('skips an order silently if EasyPost returns no rates', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(makeErrorShipmentResponse())
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groundAdvantage).toHaveLength(0)
    expect(body.envelopes).toHaveLength(0)
  })

  it('skips an order silently if label purchase returns no label_url', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeFailedBuyResponse())
    const res = await makeRequest([BASE_ORDER])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.envelopes).toHaveLength(0)
  })
})

describe('POST /api/labels/batch — Firestore writes', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
  })

  it('creates batch document when batchId is provided', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    await makeRequest([BASE_ORDER])
    const setDocCalls = mockSet.mock.calls
    const batchWrite = setDocCalls.find((call) =>
      JSON.stringify(call[0]).includes('batchName')
    )
    expect(batchWrite).toBeDefined()
    expect(batchWrite[0].batchName).toBe('Test Batch')
  })

  it('saves order document with correct cost breakdown fields', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    await makeRequest([{ ...BASE_ORDER, usePennySleeve: true, useTopLoader: true }])
    const setDocCalls = mockSet.mock.calls
    const orderWrite = setDocCalls.find((call) =>
      JSON.stringify(call[0]).includes('trackingCode')
    )
    expect(orderWrite).toBeDefined()
    expect(orderWrite[0].trackingCode).toBe('USPS1234567890')
    expect(orderWrite[0].labelCost).toBe(0.63)
    expect(typeof orderWrite[0].totalCost).toBe('number')
  })
})

describe('POST /api/labels/batch — post-processing', () => {
  it('updates usage count for free users after success', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageUnderLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await makeRequest([BASE_ORDER])
    const setDocCalls = mockSet.mock.calls
    const usageWrite = setDocCalls.find((call) =>
      JSON.stringify(call[0]).includes('"count"')
    )
    expect(usageWrite).toBeDefined()
    expect(usageWrite[0].count).toBe(6)
  })

  it('does NOT update usage count for Pro users', async () => {
    mockGet
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await makeRequest([BASE_ORDER])
    const setDocCalls = mockSet.mock.calls
    const usageWrite = setDocCalls.find(
      (call) =>
        JSON.stringify(call[0]).includes('"count"') &&
        JSON.stringify(call[0]).includes('"month"')
    )
    expect(usageWrite).toBeUndefined()
  })

  it('returns groundAdvantage and envelopes arrays separated correctly', async () => {
    mockGet
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockNoUsage)
    const envelopeOrder = { ...BASE_ORDER, orderNumber: 'ORDER-001', useEnvelope: true }
    const groundOrder = { ...BASE_ORDER, orderNumber: 'ORDER-002', useEnvelope: false }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
      .mockResolvedValueOnce(makeShipmentResponse([GROUND_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await makeRequest([envelopeOrder, groundOrder])
    const body = await res.json()
    expect(body.envelopes).toHaveLength(1)
    expect(body.groundAdvantage).toHaveLength(1)
  })
})
