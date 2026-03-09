/**
 * Tests for POST /api/labels/single (Hono route)
 */
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
  orderNumber: 'ORDER-001',
  customAddress: {
    name: 'Jane Smith',
    street1: '100 Elm St',
    city: 'Shelbyville',
    state: 'TN',
    zip: '37160',
    country: 'US',
  },
  // selectedPackage intentionally omitted — Zod rejects null for .optional() fields
  nonMachinable: false,
}

const makeRequest = (body: object) =>
  app.request('/api/labels/single', {
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

describe('POST /api/labels/single — input validation', () => {
  it('returns 400 if customAddress is missing', async () => {
    const res = await makeRequest({ ...BASE_ORDER, customAddress: undefined })
    expect(res.status).toBe(400)
  })

  it('returns 400 if user settings are incomplete', async () => {
    mockGet.mockResolvedValueOnce(mockNoSettingsUser)
    const res = await makeRequest(BASE_ORDER)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/labels/single — free tier enforcement', () => {
  it('returns 403 if free user is at 10-label limit', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    const res = await makeRequest(BASE_ORDER)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.redirect).toBe('/dashboard/billing')
  })
})

describe('POST /api/labels/single — rate selection', () => {
  beforeEach(() => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
  })

  it('filters to only USPS First or GroundAdvantage rates', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE, CHEAP_NON_USPS_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await makeRequest(BASE_ORDER)
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.carrier).toBe('USPS')
  })

  it('returns 400 if no valid USPS rate is available', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      makeShipmentResponse([CHEAP_NON_USPS_RATE])
    )
    const res = await makeRequest(BASE_ORDER)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No USPS/i)
  })

  it('selects cheapest valid USPS rate', async () => {
    const cheapFirst = { ...ENVELOPE_RATE, rate: '0.55' }
    const expensiveGround = { ...GROUND_RATE, rate: '5.40' }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([expensiveGround, cheapFirst]))
      .mockResolvedValueOnce(makeBuyResponse())
    await makeRequest(BASE_ORDER)
    const buyCall = (global.fetch as jest.Mock).mock.calls[1]
    const buyBody = JSON.parse(buyCall[1].body)
    expect(buyBody.rate.rate).toBe('0.55')
  })
})

describe('POST /api/labels/single — Firestore writes', () => {
  beforeEach(() => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
  })

  it('creates or merges the "single-labels" batch document', async () => {
    await makeRequest(BASE_ORDER)
    const setDocCalls = mockSet.mock.calls
    const batchWrite = setDocCalls.find((call) =>
      JSON.stringify(call[0]).includes('Single Labels')
    )
    expect(batchWrite).toBeDefined()
  })

  it('saves order document with correct fields', async () => {
    await makeRequest(BASE_ORDER)
    const setDocCalls = mockSet.mock.calls
    const orderWrite = setDocCalls.find((call) =>
      JSON.stringify(call[0]).includes('trackingCode')
    )
    expect(orderWrite[0].trackingCode).toBe('USPS1234567890')
    expect(orderWrite[0].labelUrl).toBe('https://easypost.com/label.pdf')
    expect(orderWrite[0].batchId).toBe('single-labels')
  })
})

describe('POST /api/labels/single — post-processing', () => {
  it('returns labelUrl and trackingCode on success', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockNoUsage)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    const res = await makeRequest(BASE_ORDER)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.labelUrl).toBe('https://easypost.com/label.pdf')
    expect(body.trackingCode).toBe('USPS1234567890')
  })

  it('updates usage for free users after success', async () => {
    mockGet
      .mockResolvedValueOnce(mockFreeUser)
      .mockResolvedValueOnce(mockUsageUnderLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await makeRequest(BASE_ORDER)
    const setDocCalls = mockSet.mock.calls
    const usageWrite = setDocCalls.find((call) =>
      JSON.stringify(call[0]).includes('"count"')
    )
    expect(usageWrite[0].count).toBe(6)
  })

  it('does NOT update usage for Pro users', async () => {
    mockGet
      .mockResolvedValueOnce(mockProUser)
      .mockResolvedValueOnce(mockUsageAtLimit)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeShipmentResponse([ENVELOPE_RATE]))
      .mockResolvedValueOnce(makeBuyResponse())
    await makeRequest(BASE_ORDER)
    const setDocCalls = mockSet.mock.calls
    const usageWrite = setDocCalls.find(
      (call) =>
        JSON.stringify(call[0]).includes('"count"') &&
        JSON.stringify(call[0]).includes('"month"')
    )
    expect(usageWrite).toBeUndefined()
  })
})
