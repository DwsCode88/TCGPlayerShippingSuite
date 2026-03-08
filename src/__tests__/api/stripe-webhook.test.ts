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
