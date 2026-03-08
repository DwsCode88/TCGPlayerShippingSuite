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
