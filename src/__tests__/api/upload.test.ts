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
