/**
 * Tests for POST /api/stripe/webhook (Hono route)
 */
import { makeCheckoutEvent, makeUnhandledEvent } from '../mocks/stripe'

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }))
})

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

import { app } from '@/app/api/[[...route]]/route'
import Stripe from 'stripe'

// Stripe is instantiated at module-level in route.ts when this file is imported.
// Capture the mock instance's webhooks reference here — before any clearAllMocks().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripeWebhooks = (Stripe as any).mock.results[0]?.value?.webhooks as {
  constructEvent: jest.Mock
}

let mockGet: jest.Mock
let mockSet: jest.Mock
// The route calls docRef.set(data, options) — MOCK_USER_DOC_REF must have a set method
let MOCK_USER_DOC_REF: { id: string; set: jest.Mock }

const makeRequest = (body = 'raw-body') =>
  app.request('/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: {
      'stripe-signature': 'mock-sig',
      'Content-Type': 'application/json',
    },
  })

beforeEach(() => {
  jest.clearAllMocks()
  mockGet = jest.fn()
  mockSet = jest.fn().mockResolvedValue(undefined)
  MOCK_USER_DOC_REF = { id: 'user123', set: mockSet }

  const { adminDb } = jest.requireMock('@/lib/admin')
  adminDb.collection.mockReturnValue({
    doc: jest.fn().mockReturnValue({ get: mockGet, set: mockSet }),
    where: jest.fn().mockReturnValue({ get: mockGet }),
  })
})

describe('POST /api/stripe/webhook', () => {
  it('returns 400 if signature verification fails', async () => {
    stripeWebhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await makeRequest()
    expect(res.status).toBe(400)
  })

  it('returns 200 and does nothing for unhandled event types', async () => {
    stripeWebhooks.constructEvent.mockReturnValue(makeUnhandledEvent())
    const res = await makeRequest()
    expect(res.status).toBe(200)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('sets isPro: true on user doc when checkout.session.completed fires', async () => {
    stripeWebhooks.constructEvent.mockReturnValue(makeCheckoutEvent('buyer@example.com'))
    // where().get() returns a query snapshot with docs
    mockGet.mockResolvedValue({
      docs: [{ ref: MOCK_USER_DOC_REF }],
    })
    const res = await makeRequest()
    expect(res.status).toBe(200)
    // Route calls docRef.set({ isPro: true, stripeCustomerId: ... }, { merge: true })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ isPro: true }),
      { merge: true }
    )
  })

  it('continues gracefully if session has no customer_email', async () => {
    stripeWebhooks.constructEvent.mockReturnValue(makeCheckoutEvent(null))
    const res = await makeRequest()
    expect(res.status).toBe(200)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('continues gracefully if no Firestore user matches the email', async () => {
    stripeWebhooks.constructEvent.mockReturnValue(makeCheckoutEvent('nobody@example.com'))
    mockGet.mockResolvedValue({ docs: [] })
    const res = await makeRequest()
    expect(res.status).toBe(200)
    expect(mockSet).not.toHaveBeenCalled()
  })
})
