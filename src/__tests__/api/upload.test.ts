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
    const order = { ...BASE_ORDER, useEnvelope: false }
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
    expect(usageWrite[1].count).toBe(6)
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
